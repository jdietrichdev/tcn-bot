import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
// import { dbClient } from "../clients/dynamodb-client";
import { getCommandOptionData, getGuildId, getMessageSender } from "./utils";

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
    const params = {
      pk: `${getGuildId(interaction)}#${
        getCommandOptionData(interaction, "user") ??
        getMessageSender(interaction)
      }`,
    };
    console.log(params);
    // dbClient.send(params);
  } catch (err) {
    console.log("Failure adding player", err);
    throw err;
  }
};
