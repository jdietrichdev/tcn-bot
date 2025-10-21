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
    if (index !== -1) question.responses[index].response = question[option];
    else question.responses.push({ 
      userId: interaction.member!.user.id,
      username: interaction.member!.user.username,
      response: question[option],
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: eventData,
      })
    );

    // Calculate percentages and create visual bars
    const totalResponses = question.responses.length;
    const optionCounts = {
      optionOne: question.responses.filter((r: QuestionResponse) => r.response === question.optionOne).length,
      optionTwo: question.responses.filter((r: QuestionResponse) => r.response === question.optionTwo).length,
      optionThree: question.optionThree ? question.responses.filter((r: QuestionResponse) => r.response === question.optionThree).length : 0,
      optionFour: question.optionFour ? question.responses.filter((r: QuestionResponse) => r.response === question.optionFour).length : 0
    };

    const createBar = (count: number) => {
      const percentage = Math.round((count / totalResponses) * 100) || 0;
      const filledBlocks = Math.round(percentage / 10);
      const emptyBlocks = 10 - filledBlocks;
      return `${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${percentage}%`;
    };

    const description = `**Response Distribution**\n━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ ${question.optionOne}\n${createBar(optionCounts.optionOne)} (${optionCounts.optionOne})\n\n` +
      `2️⃣ ${question.optionTwo}\n${createBar(optionCounts.optionTwo)} (${optionCounts.optionTwo})` +
      (question.optionThree ? `\n\n3️⃣ ${question.optionThree}\n${createBar(optionCounts.optionThree)} (${optionCounts.optionThree})` : '') +
      (question.optionFour ? `\n\n4️⃣ ${question.optionFour}\n${createBar(optionCounts.optionFour)} (${optionCounts.optionFour})` : '') +
      `\n\n📊 **Total Responses:** ${totalResponses}`;

    const updatedMessageEmbed = {
      ...interaction.message.embeds[0],
      description,
      color: 0x6B65F2, // More purple variant of Discord blurple
      ...(question.thumbnailUrl && {
        image: {
          url: question.thumbnailUrl
        }
      }),
      footer: {
        text: "Click a button below to submit your answer • You can change your answer at any time"
      }
    };
    await updateMessage(interaction.channel.id, interaction.message.id, {
      ...interaction.message,
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
