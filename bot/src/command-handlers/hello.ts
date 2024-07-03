import {
  APIApplicationCommandInteractionDataUserOption,
  // APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { getCommandOptionData } from "./utils";
import { updateMessage } from "../adapters/discord-adapter";

export const handleHello = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  console.log(interaction);
  const userData = getCommandOptionData(interaction, 'user') as APIApplicationCommandInteractionDataUserOption;
  const response = { type: 4, data: { contents: `Hello <@${userData.value}>!`}}
  await updateMessage(interaction.application_id, interaction.token, response);
};
