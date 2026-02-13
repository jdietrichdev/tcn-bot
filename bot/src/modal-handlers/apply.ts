import {
  InteractionResponseType,
  ComponentType,
  TextInputStyle,
  APIInteractionResponse,
  APIModalSubmitInteraction,
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIEmbed,
  ModalSubmitActionRowComponent,
  RESTPostAPIWebhookWithTokenJSONBody,
  APIMessageComponentInteraction,
  APIApplicationCommandInteraction,
} from "discord-api-types/v10";
import {
  createThread,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getConfig, ServerConfig } from "../util/serverConfig";
import { BUTTONS } from "../component-handlers/buttons";

export const createApplyModal = (interaction: APIMessageComponentInteraction | APIApplicationCommandInteraction) => {
  const config = getConfig(interaction.guild_id!);
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: "applicationModal",
      title: config.APPLICATION_QUESTIONS!.title,
      components: config.APPLICATION_QUESTIONS!.questions.map((question) => {
        return {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: question.custom_id,
              label: question.label,
              style: TextInputStyle.Paragraph,
              required: true,
            },
          ],
        };
      })
    },
  } as APIInteractionResponse;
};

export const submitApplyModal = async (
  interaction: APIModalSubmitInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const confirmation = buildApplicationConfirmation(interaction, config);
    const message = await sendMessage(
      confirmation,
      config.APP_APPROVAL_CHANNEL
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Thanks for applying <@${interaction.member?.user.id}>! Due to a high influx of recruits, there may be a short wait time until a recruiter accepts your application.`,
    });
    const thread = await createThread(
      {
        name: `Application discussion for ${interaction.member?.user.username}`,
        auto_archive_duration: 4320,
      },
      message.channel_id,
      message.id
    );
    await sendMessage(
      {
        content: `\`${interaction.data.components[0].components[0].value}\``,
      },
      thread.id
    );
  } catch (err) {
    console.error(`Failed to submit modal: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There may have been an error handling your application, if you do not hear back soon reach out to leaders",
    });
  }
};

const buildApplicationConfirmation = (
  interaction: APIModalSubmitInteraction,
  config: ServerConfig
): RESTPostAPIWebhookWithTokenJSONBody => {
  const embed: APIEmbed = {
    title: `Application for ${interaction.member?.user.username}`,
    description: "Application responses",
    fields: [
      ...interaction.data.components.map(
        (item: ModalSubmitActionRowComponent) => {
          const response = item.components[0];
          return {
            name: config.APPLICATION_QUESTIONS?.questions.find(
              (question) => question.custom_id === response.custom_id
            )?.label as string,
            value: response.value,
          };
        }
      ),
      {
        name: "userId",
        value: interaction.member!.user.id,
      },
    ],
    footer: {
      text: "Would you like to accept this application?",
    },
  };

  const responseButtons: APIActionRowComponent<APIButtonComponentWithCustomId> =
    {
      type: ComponentType.ActionRow,
      components: [BUTTONS.APPROVE_APP, BUTTONS.DENY_APP],
    };
  return {
    content: `<@&${config.RECRUITER_ROLE}>`,
    embeds: [embed],
    components: [responseButtons],
  };
};
