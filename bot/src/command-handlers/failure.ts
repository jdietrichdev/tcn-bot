import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const handleFailure = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const response = {
    content: "Processing of this command failed, please try again",
  };
  await updateMessage(interaction.application_id, interaction.token, response);
};
