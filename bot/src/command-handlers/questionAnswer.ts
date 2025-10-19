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
    const points =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "points"
      )?.value ?? 1;

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
    question.points = points;

    const scoreboard: Record<string, any>[] = eventData.scoreboard ?? [];
    console.log(scoreboard);
    for (const response of question.responses) {
      if (response.answer === answer) {
        const index = scoreboard.findIndex((score) => score.id === response.userId);
        if (index !== -1) scoreboard[index].points += Number(points);
        else scoreboard.push({ id: response.userId, points: Number(points) });
      }
    }
    eventData.scoreboard = scoreboard;

    await updateMessage(interaction.channel.id, question.message, {
      content: `Correct answer: ${answer}\nPoints Rewarded: ${points}`,
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
