import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { dbClient } from "../clients/dynamodb-client";
import { getCommandOptionData, getGuildId, getMessageSender } from "./utils";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

export const handlePlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "add":
        return await addPlayer(interaction);
      default:
        throw new Error("No processing defined for that command");
    }
  } catch (err) {
    console.log("Failure handling player command", err);
    throw err;
  }
};

const addPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = getGuildId(interaction);
    console.log(guildId);
    const rosterObject =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "roster"
      );
    console.log(rosterObject);
    const roster = rosterObject.value;
    console.log(roster);
    const user =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "user"
      );
    console.log(user);
    const id = user ? user.value : getMessageSender(interaction).id;
    console.log(id);
    const name = user
      ? interaction.data.resolved!.users![id].global_name!
      : interaction.member!.user.global_name!;
    console.log(name);
    dbClient.send(
      new UpdateItemCommand({
        TableName: "SchedulingTable",
        Key: {
          pk: { S: guildId },
          sk: {
            S: `member#${roster}#${id}`,
          },
        },
        UpdateExpression: "SET roster=:roster, id=:id, name=:name",
        ExpressionAttributeValues: {
          ":roster": { S: roster },
          ":id": { S: id },
          ":name": { S: name },
        },
      })
    );
  } catch (err) {
    console.log("Failure adding player", err);
    throw err;
  }
};
