import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { dbClient } from "../clients/dynamodb-client";
import { getGuildId, getMessageSender, getSubCommandOptionData } from "./utils";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { updateMessage } from "../adapters/discord-adapter";

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
      getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "add",
        "roster"
      );
    console.log(rosterObject);
    const roster = rosterObject.value;
    console.log(roster);
    const user =
      getSubCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "add",
        "user"
      );
    console.log(user);
    const id = user ? user.value : getMessageSender(interaction).id;
    console.log(id);
    const name = user
      ? interaction.data.resolved!.users![id].global_name!
      : interaction.member!.user.global_name!;
    console.log(name);
    const response = await dbClient.send(
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
        ReturnValues: 'ALL_NEW'
      })
    );
    console.log(response);
    await updateMessage(interaction.application_id, interaction.token, {
      content: `${name} added to ${roster} rosters`
    });
  } catch (err) {
    console.log("Failure adding player", err);
    throw err;
  }
};
