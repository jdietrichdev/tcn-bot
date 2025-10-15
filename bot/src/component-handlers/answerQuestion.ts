import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const answerQuestion = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const [, option, eventId, questionId] =
      interaction.data.custom_id.split("_");

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

    const question = eventData.questions.find(
      (question: Record<string, any>) => {
        return question.id === questionId;
      }
    );

    console.log(question + " " + option);
    console.log(question[option]);

    question.responses.push({
      userId: interaction.member!.user.id,
      userName: interaction.member!.user.username,
      answer: question[option],
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: eventData,
      })
    );

    const updatedMessageEmbed = {
      ...interaction.message.embeds[0],
      description: `Total Responses: ${question.responses.length}`,
    };
    await updateMessage(interaction.channel.id, interaction.message.id, {
      embeds: [updatedMessageEmbed],
    });
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Thanks for your response, stay tuned for the result!",
    });
  } catch (err) {
    console.log("Failure registering answer", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Failed to register your answer, please try again",
    });
  }
};
