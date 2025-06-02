import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { verify } from "../adapters/coc-api-adapter";
import { updateResponse } from "../adapters/discord-adapter";
import { dbClient } from "../clients/dynamodb-client";
import {
  DeleteItemCommand,
  ReturnValue,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  getGuildId,
  getMessageSender,
  getSubCommandOptionData,
} from "../util/interaction-util";

export const handleLink = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "create":
        return await linkPlayer(interaction);
      case "remove":
        return await unlinkPlayer(interaction);
      default:
        throw new Error("No processing defined for that command");
    }
  } catch (err) {
    console.log("Failure handling link command", err);
    throw err;
  }
};

const linkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const playerTag =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "create",
      "tag"
    ).value;
  const apiToken =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "create",
      "token"
    ).value;
  const guildId = getGuildId(interaction);
  const user = getMessageSender(interaction).id;

  try {
    await verify(playerTag, apiToken);
    const response = await dbClient.send(
      new UpdateItemCommand({
        TableName: "SchedulingTable",
        Key: {
          pk: { S: guildId },
          sk: { S: `player#${user}#${playerTag.substring(1)}` },
        },
        UpdateExpression: "SET id=:id, tag=:tag",
        ExpressionAttributeValues: {
          ":id": { S: user },
          ":tag": { S: playerTag },
        },
        ReturnValues: ReturnValue.NONE,
      })
    );
    console.log(response);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "User successfully linked",
    });
  } catch (err) {
    console.log("Failure linking account", err);
    throw err;
  }
};

const unlinkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const playerTag =
      getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "remove",
        "tag"
      ).value;
    const guildId = getGuildId(interaction);
    const user = getMessageSender(interaction).id;
    const response = await dbClient.send(
      new DeleteItemCommand({
        TableName: "SchedulingTable",
        Key: {
          pk: { S: guildId },
          sk: { S: `player#${user}#${playerTag.substring(1)}` },
        },
      })
    );
    console.log(response);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "User successfully unlinked",
    });
  } catch (err) {
    console.log("Failure unlinking account", err);
    throw err;
  }
};
