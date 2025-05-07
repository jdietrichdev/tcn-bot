import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteMessage, deleteResponse } from "../adapters/discord-adapter";

export const rejectDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    await deleteMessage(interaction.channel.id, interaction.message.id);
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failed to reject deletion of channel: ${err}`);
  }
};
