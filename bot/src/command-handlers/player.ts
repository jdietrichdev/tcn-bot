import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { dbClient } from "../clients/dynamodb-client";
import { ReturnValue, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { updateMessage } from "../adapters/discord-adapter";
import {
  getGuildId,
  getMessageSender,
  getSubCommandOptionData,
} from "../util/interaction-util";

export const handlePlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "add":
        return await addPlayer(interaction);
        break;
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
    const rosterObject =
      getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "add",
        "roster"
      );
    const roster = rosterObject.value;
    const user =
      getSubCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "add",
        "user"
      );
    const id = user ? user.value : getMessageSender(interaction).id;
    const username = user
      ? interaction.data.resolved!.users![id].global_name!
      : interaction.member!.user.global_name!;
    const response = await dbClient.send(
      new UpdateItemCommand({
        TableName: "SchedulingTable",
        Key: {
          pk: { S: guildId },
          sk: {
            S: `member#${roster}#${id}`,
          },
        },
        UpdateExpression: "SET roster=:roster, id=:id, username=:username",
        ExpressionAttributeValues: {
          ":roster": { S: roster },
          ":id": { S: id },
          ":username": { S: username },
        },
        ReturnValues: ReturnValue.NONE,
      })
    );
    if (response["$metadata"].httpStatusCode !== 200)
      throw new Error(`Failed adding player ${username}`);
    await updateMessage(interaction.application_id, interaction.token, {
      content: `${username} added to ${roster} roster`,
    });
  } catch (err) {
    console.log("Failure adding player", err);
    throw err;
  }
};
