import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteChannel, updateResponse } from "../adapters/discord-adapter";

export const confirmDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    await deleteChannel(interaction.channel.id);
  } catch (err) {
    console.error(`Failed to delete channel: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue deleting the channel, please try again or reach out to admins",
    });
  }
};
