import {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIEmbed,
  APIInteractionResponse,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  ModalSubmitActionRowComponent,
  TextInputStyle,
} from "discord-api-types/payloads/v10";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import { BUTTONS } from "../component-handlers/buttons";

const questionMapping = {
  tags: "Player tag(s)",
  source: "How did you find us? Who reached out to you?",
  leaveClan: "Why did you leave your last clan?",
  clanWants: "What do you want in a clan?",
  strategies: "Favorite strategies",
};

export const createApplyModal = () => {
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: "applicationModal",
      title: "Apply for This Clan Now",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "tags",
              label: "Player tag(s)",
              style: TextInputStyle.Short,
              required: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "source",
              label: "How did you find us? Who reached out to you?",
              style: TextInputStyle.Paragraph,
              required: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "leaveClan",
              label: "Why did you leave your last clan?",
              style: TextInputStyle.Paragraph,
              required: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "clanWants",
              label: "What do you want in a clan?",
              style: TextInputStyle.Paragraph,
              required: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "strategies",
              label: "Favorite strategies?",
              style: TextInputStyle.Paragraph,
              required: true,
            },
          ],
        },
      ],
    },
  } as APIInteractionResponse;
};

export const handleApplySubmit = async (
  interaction: APIModalSubmitInteraction
) => {
  //   console.log(JSON.stringify(interaction));
  try {
    const config = getConfig(interaction.guild_id!);
    const confirmation = buildApplicationConfirmation(interaction, config);
    await sendMessage(confirmation, config.APP_APPROVAL_CHANNEL);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Thanks for applying <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    console.error("Failed to submit modal");
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
            name: questionMapping[
              response.custom_id as keyof typeof questionMapping
            ],
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
