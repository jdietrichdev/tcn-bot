import {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIEmbed,
  APIInteractionResponse,
  APIModalSubmitInteraction,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  ModalSubmitActionRowComponent,
  TextInputStyle,
} from "discord-api-types/payloads/v10";
import { sendMessage, updateMessage } from "../adapters/discord-adapter";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

export const createApplyModal = async () => {
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
              label: "How did you find us?",
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
  console.log(JSON.stringify(interaction));
  const confirmation = buildApplicationConfirmation(interaction);
  await sendMessage(confirmation, "1367868025440833576");
  await updateMessage(interaction.application_id, interaction.token, {
    content: `Thanks for applying <@${interaction.member?.user.id}>`,
  });
};

const buildApplicationConfirmation = (
  interaction: APIModalSubmitInteraction
): RESTPostAPIWebhookWithTokenJSONBody => {
  const embed: APIEmbed = {
    title: `Application for ${interaction.member?.user.username}`,
    description: "Application responses",
    fields: [
      ...interaction.data.components.map(
        (item: ModalSubmitActionRowComponent) => {
          const response = item.components[0];
          return {
            name: response.custom_id,
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
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: "Approve",
          custom_id: "approveApp",
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Danger,
          label: "Deny",
          custom_id: "denyApp",
        },
      ],
    };
  return {
    embeds: [embed],
    components: [responseButtons],
  };
};
