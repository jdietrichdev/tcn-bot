import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  APITextChannel,
} from "discord-api-types/v10";
import {
  deleteResponse,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Question } from "../util/interfaces";

export const handleQuestionAnswer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const questionId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "question"
      ).value;
    const answer =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "answer"
      ).value;

    const eventId = (interaction.channel as APITextChannel).topic;

    const eventData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `event#${eventId}`,
          },
        })
      )
    ).Item!;

    const questions = eventData.questions;
    const question = questions.find(
      (question: Question) => question.id === questionId
    );
    question.answer = answer;

    await updateMessage(interaction.channel.id, question.message, {
      content: `Correct answer: ${answer}`,
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: eventData,
      })
    );

    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.log("Failed to handle answer for question", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Failed to set answer for question, please try again",
    });
  }
};
