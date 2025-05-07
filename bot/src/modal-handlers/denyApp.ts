import {
  InteractionResponseType,
  APIMessageComponentInteraction,
  ComponentType,
  TextInputStyle,
  APIInteractionResponse,
  APIModalSubmitInteraction,
} from "discord-api-types/v10";
import {
  deleteResponse,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";

export const createDenyAppModal = (
  interaction: APIMessageComponentInteraction
) => {
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: `denyAppModal_${interaction.channel.id}_${
        interaction.message.id
      }_${interaction.message.embeds![0].fields![5].value}`,
      title: `Denying application for ${
        interaction.message.embeds[0].title?.split(" ")[2]
      }`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "reason",
              label: "Reason for denial",
              style: TextInputStyle.Short,
            },
          ],
        },
      ],
    },
  } as APIInteractionResponse;
};

export const submitDenyAppModal = async (
  interaction: APIModalSubmitInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const [channelId, messageId, userId] = interaction.data.custom_id
      .split("_")
      .splice(1);
    await sendMessage(
      {
        content: `<@${userId}> thank you for your application, but it was denied for the following reasons: ${interaction.data.components[0].components[0].value}`,
      },
      config.GUEST_CHAT_CHANNEL
    );
    await updateMessage(channelId, messageId, {
      content: `Denied by ${interaction.member?.user.username}`,
      components: [],
    });
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failure denying app: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue denying this application, if a message was not sent in guest chat then try again or reach out to admins",
    });
  }
};
