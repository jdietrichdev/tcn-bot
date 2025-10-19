import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Question, QuestionResponse } from "../util/interfaces";

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

    const question = eventData.questions.find((question: Question) => {
      return question.id === questionId;
    });

    console.log(question + " " + option);
    console.log(question[option]);

    const index = question.responses.findIndex((response: QuestionResponse) => response.userId === interaction.member!.user.id);
    if (index !== -1) question.responses[index].answer = question[option];
    else question.responses.push({ 
      userId: interaction.member!.user.id,
      username: interaction.member!.user.username,
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
