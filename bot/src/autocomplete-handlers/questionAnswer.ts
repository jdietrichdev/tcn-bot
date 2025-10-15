import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  APITextChannel,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { Question } from "../util/interfaces";

export const handleQuestionAnswer = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };
  const eventId = (interaction.channel as APITextChannel).topic;

  const focused = (
    interaction.data
      .options as APIApplicationCommandInteractionDataStringOption[]
  ).find((option) => option.focused);

  if (focused) {
    const questions = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `event#${eventId}`,
          },
        })
      )
    ).Item!.questions;

    if (focused.name === "question") {
      options.choices = questions
        .filter((question: Question) => !question.answer)
        .map((question: Question) => {
          return {
            name: question.question,
            value: question.id,
          };
        });

      console.log(options);
    } else if (focused.name === "answer") {
      const questionId = interaction.data.options.find(
        (option: APIApplicationCommandInteractionDataOption) =>
          option.name === "question"
      ) as APIApplicationCommandInteractionDataStringOption;
      if (questionId) {
        const question = questions.find(
          (question: Question) => question.id === questionId.value
        );
        const optionKeys = Object.keys(question).filter((key: string) =>
          key.startsWith("option")
        );
        options.choices = optionKeys.map((key: string) => {
          return {
            name: question[key],
            value: question[key],
          };
        });
      }
    }
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
