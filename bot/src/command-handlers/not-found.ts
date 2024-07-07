import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const handleCommandNotFound = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const response = {
    content: "Handling for this function has not yet been defined",
  };
  await updateMessage(interaction.application_id, interaction.token, response);
};
