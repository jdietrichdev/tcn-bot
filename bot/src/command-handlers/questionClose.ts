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

export const handleQuestionClose = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const questionId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "question"
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

    if (!eventData) {
      throw new Error("No event found for this channel");
    }

    const questions = eventData.questions;

    if (!questions) {
      throw new Error("No questions found for this event");
    }

    const question = questions.find(
      (question: Question) => question.id === questionId
    );
    question.closed = true;

    await updateMessage(interaction.channel.id, question.message, {
      components: [],
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: eventData,
      })
    );

    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.log("Failed to close question", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Failure closing question, please try again",
    });
  }
};
