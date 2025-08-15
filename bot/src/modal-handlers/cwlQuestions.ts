import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const createCwlQuestionsModal = (
  interaction: APIMessageComponentInteraction
) => {
  try {
    console.log(JSON.stringify(interaction));

    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: "cwlQuestions",
        title: interaction.message.embeds[0].title,
        description: `Questions for ${interaction.member!.user.username}`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                custom_id: "league",
                label: "What league do you want your account(s) in?",
                style: TextInputStyle.Paragraph,
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
                label: "Will you be available for all of CWL?",
                style: TextInputStyle.Paragraph,
                required: false,
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                custom_id: "competitiveness",
                label: "Do you want a competitive or relaxed CWL?",
                style: TextInputStyle.Paragraph,
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
    console.log(`Failed to create question modal: ${err}`);
    throw err;
  }
};

export const submitCwlQuestionsModal = async (
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
      username: interaction.member!.user.username,
      ...responses,
    };
    const questions = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `questions#${interaction.message!.embeds[0].title}`,
          },
        })
      )
    ).Item!;
    console.log(JSON.stringify(questions));

    questions.accounts.push(account);

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: questions,
      })
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Thanks for answering the questions <@${interaction.member?.user.id}>!`,
    });
  } catch (err) {
    console.log(`Failed to process CWL questions: ${err}`);
    throw err;
  }
};
