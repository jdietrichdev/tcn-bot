import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";

export const denyApp = async (
  interaction: APIMessageComponentInteraction,
  config: ServerConfig
) => {
  try {
    await sendMessage(
      {
        content: `<@${
          interaction.message.embeds![0].fields![5].value
        }> thank you for your application, but your account does not currently meet our criteria, feel free to reapply at a later time`,
      },
      config.GUEST_CHAT_CHANNEL
    );
    await updateMessage(interaction.channel.id, interaction.message.id, {
      content: `Denied by ${interaction.member?.user.username}`,
      components: [],
    });
  } catch (err) {
    console.error(`Failure denying app: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue denying this application, if a message was not sent in guest chat then try again or reach out to admins",
    });
  }
};
