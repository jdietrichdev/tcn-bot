import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
} from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";

export const createCwlAccountSignupModal = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    await updateMessage(interaction.channel.id, interaction.message.id, {
      content: "Account being added to roster",
    });
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: "cwlSignupModal",
        title: `Signup for ${
          (interaction.data as APIMessageSelectMenuInteractionData).values[0]
        }`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                custom_id: "league",
                label: "What league would you like to play in?",
                style: TextInputStyle.Short,
                required: false,
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                custom_id: "availability",
                label: "How available will you be during week of CWL?",
                style: TextInputStyle.Short,
                required: false,
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                custom_id: "notes",
                label: "Anything else we should know?",
                style: TextInputStyle.Paragraph,
                required: false,
              },
            ],
          },
        ],
      },
    } as APIInteractionResponse;
  } catch (err) {
    console.log(`Failed to sign up account: ${err}`);
    throw err;
  }
};

export const submitCwlAccountSignupModal = async (
  interaction: APIModalSubmitInteraction
) => {
  try {
    console.log(JSON.stringify(interaction));
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Thanks for signing up!",
    });
  } catch (err) {
    console.log(`Failed to finalize account signup: ${err}`);
    throw err;
  }
};
