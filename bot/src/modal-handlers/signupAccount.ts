import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  APIModalSubmitInteraction,
  APIStringSelectComponent,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const createCwlAccountSignupModal = (
  interaction: APIMessageComponentInteraction
) => {
  try {
    console.log(JSON.stringify(interaction));
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: "cwlSignupModal",
        title: interaction.message.content.split("\n")[0],
        description: `Signup for ${
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
                label: "How available will you be during CWL?",
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
    const responses: { [key: string]: string } = {};
    interaction.data.components.forEach((component) => {
      responses[component.components[0].custom_id] =
        component.components[0].value;
    });
    const account = {
      id: interaction.member!.user.id,
      playerTag: (
        interaction.message!.components![0]
          .components[0] as APIStringSelectComponent
      ).options[0].value,
      ...responses,
    };
    const signup = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `signup#${interaction.message?.content.split("\n")[0]}`,
          },
        })
      )
    ).Item!;
    console.log(JSON.stringify(signup));

    signup.accounts.push(account);

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: signup,
      })
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Thanks for signing up <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    console.log(`Failed to finalize account signup: ${err}`);
    throw err;
  }
};
