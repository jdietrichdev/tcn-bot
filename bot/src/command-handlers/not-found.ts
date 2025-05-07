import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";

export const handleCommandNotFound = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const response = {
    content: "Handling for this function has not yet been defined",
  };
  await updateResponse(interaction.application_id, interaction.token, response);
};
