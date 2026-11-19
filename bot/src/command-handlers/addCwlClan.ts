import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getClan } from "../adapters/coc-api-adapter";
import { updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import {
  CwlSignupRecord,
  isCwlSignupRecord,
} from "../util/cwlSignup";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const handleAddCwlClan = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const signupName =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "signup-name"
    ).value;
  const rawTag =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "clan-tag"
    ).value;
  const clanTag = rawTag.trim().replace(/^#/, "").toUpperCase();
  if (!/^[A-Z0-9]{3,15}$/.test(clanTag)) {
    throw new Error("Clan tag must contain 3 to 15 letters or numbers.");
  }

  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id!,
        sk: `signup#${signupName}`,
      },
    })
  );
  const signupItem: unknown = response.Item;
  let signup: CwlSignupRecord;
  if (signupItem === undefined) {
    signup = {
      pk: interaction.guild_id!,
      sk: `signup#${signupName}`,
      signupName,
      status: "draft",
      clans: [],
    };
  } else if (isCwlSignupRecord(signupItem)) {
    signup = signupItem;
  } else {
    throw new Error(`CWL signup "${signupName}" contains invalid data.`);
  }
  if (
    signup.status === "open" ||
    signup.channelId ||
    signup["message"] ||
    signup.clans.some((clan) => clan.messageId)
  ) {
    throw new Error("Clans cannot be changed after the CWL signup has started.");
  }

  const clanData: unknown = await getClan(`#${clanTag}`);
  if (!isRecord(clanData)) {
    throw new Error(`Could not read clan data for ${clanTag}.`);
  }
  const warLeague = clanData.warLeague;
  if (!isRecord(warLeague)) {
    throw new Error(`Clan ${clanTag} does not have a current CWL league.`);
  }

  const { name, tag } = clanData;
  const league = warLeague.name;
  if (
    typeof name !== "string" ||
    typeof tag !== "string" ||
    typeof league !== "string"
  ) {
    throw new Error(`Clan ${clanTag} is missing name, tag, or league data.`);
  }

  const normalizedTag = tag.replace(/^#/, "").toUpperCase();
  const clans = signup.clans;
  if (clans.some((clan) => clan.tag.toUpperCase() === normalizedTag)) {
    throw new Error(`${name} is already in this CWL signup.`);
  }
  clans.push({
    name,
    tag: normalizedTag,
    league,
    link: `https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${normalizedTag}`,
    accounts: [],
  });
  signup.signupName = signupName;
  signup.status = "draft";
  signup.clans = clans;

  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: signup,
    })
  );
  await updateResponse(interaction.application_id, interaction.token, {
    content: `Added [${name}](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${normalizedTag}>) to **${signupName}** (${league}). Add any other clans, then run \`/initiate-cwl-signup\`.`,
  });
};
