import { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  deleteResponse,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";

export const closeRecruit = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    await updateMessage(interaction.channel.id, interaction.message.id, {
      content: interaction.message.content.split("\n").splice(1).join("\n"),
      components: [],
    });
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failure closing recruit message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue closing this recruit message, please try again or contact admins if you continue seeing issues",
    });
  }
};
