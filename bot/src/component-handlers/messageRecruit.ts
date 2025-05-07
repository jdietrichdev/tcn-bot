import { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  deleteResponse,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";

export const messageRecruit = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    await updateMessage(interaction.channel.id, interaction.message.id, {
      content:
        interaction.message.content +
        "\n" +
        `Messaged by ${interaction.member?.user.username}`,
    });
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failure updating recruit message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue updating the message, if you do not see your username in the original message please try again or reach out to admins",
    });
  }
};
