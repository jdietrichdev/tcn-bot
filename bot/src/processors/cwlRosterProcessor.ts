import { S3Event } from "aws-lambda";
import { s3Client } from "../clients/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { parse } from "csv-parse/sync";
import { getServerMembers } from "../adapters/discord-adapter";
import { APIGuildMember } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

interface Player {
  playerTag: string;
  playerName: string;
  userId: string;
}

interface ClanRoster {
  clanTag: string;
  league: string;
  players: Player[];
}

export const processCwlRoster = async (event: S3Event) => {
  try {
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key.replace(/\+/g, ' ');
      console.log(key);
      
      if (record.s3.object.size !== 0) {
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        const csvData = await streamCsv(response.Body as Readable);

        const records: Record<string, string>[] = parse(csvData, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        console.log(JSON.stringify(records));

        const guildId = key.split("/")[0];
        const guildMembers = await getServerMembers(guildId);

        let clanTag = "";
        let league = "";
        const clanMap = new Map<string, ClanRoster>();
        for (const record of records) {
          if (
            !Object.values(record).every((value) => value.trim() === "") &&
            record["@"] !== "@"
          ) {
            if (
              record["@"] === "" &&
              record["Player Name"] !== "" &&
              record["Combined Heroes"] !== ""
            ) {
              league = record["Player Name"];
              clanTag = record["Combined Heroes"].split("=")[2];
              if (clanTag.startsWith("%23")) clanTag = clanTag.replace("%23", "");
              clanMap.set(clanTag, {
                clanTag,
                league,
                players: [],
              });
            } else if (record["Player Name"] !== "" && record["Discord"] !== "") {
              const clanRoster = clanMap.get(clanTag);
              clanRoster?.players.push({
                playerTag: record["Player Tag"],
                playerName: record["Player Name"],
                userId:
                  guildMembers.find(
                    (member: APIGuildMember) =>
                      member.user.username === record["Discord"]
                  )?.user.id ?? record["Discord"],
              });
            }
          }
        }

        console.log("Storing roster to table");
        const tableResponse = await dynamoDbClient.send(
          new UpdateCommand({
            TableName: "BotTable",
            Key: {
              pk: guildId,
              sk: `roster#${key.split("/")[1].replace(".csv", "")}`,
            },
            ExpressionAttributeNames: {
              "#roster": "roster",
            },
            ExpressionAttributeValues: {
              ":roster": Array.from(clanMap.values()),
            },
            UpdateExpression: "set #roster = :roster",
          })
        );
        console.log(`Stored roster to table: ${JSON.stringify(tableResponse)}`);
      } else {
        console.log("Folder created, no processing required");
      }
    }
  } catch (err) {
    console.log(`Failed processing CWL roster: ${err}`);
  }
};

const streamCsv = async (stream: Readable) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};
