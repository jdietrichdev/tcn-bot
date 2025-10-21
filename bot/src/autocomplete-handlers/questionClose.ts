import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  APITextChannel,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { Question } from "../util/interfaces";

export const handleQuestionClose = async (
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

  if (focused && focused.name === "question") {
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

    options.choices = questions
      .filter(
        (question: Question) =>
          !question.answer &&
          !question.closed &&
          question.question.toLowerCase().includes(focused.value.toLowerCase())
      )
      .map((question: Question) => {
        return {
          name: question.question,
          value: question.id,
        };
      });

    console.log(options);
  } else {
    throw new Error("No handler defined for autocomplete interaction");
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
