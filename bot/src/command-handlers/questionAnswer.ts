import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  APITextChannel,
  APIEmbed,
} from 'discord-api-types/v10';
import {
  deleteResponse,
  updateMessage,
  updateResponse,
} from '../adapters/discord-adapter';
import { getCommandOptionData } from '../util/interaction-util';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Question, QuestionResponse } from '../util/interfaces';

export const handleQuestionAnswer = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  try {
    const questionId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        'question',
      ).value;
    const answer =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        'answer',
      ).value;
    const points =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        'points',
      )?.value ?? 1;

    const eventId = (interaction.channel as APITextChannel).topic;

    const eventData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: interaction.guild_id!,
            sk: `event#${eventId}`,
          },
        }),
      )
    ).Item!;

    const questions = eventData.questions;
    const question = questions.find(
      (question: Question) => question.id === questionId,
    );
    question.answer = answer;
    question.points = points;

    const scoreboard: Record<string, any>[] = eventData.scoreboard ?? [];
    console.log(scoreboard);
    for (const response of question.responses) {
      console.log(`Answer: ${answer}`);
      console.log(`${response.username} response: ${response.answer}`);
      if (response.answer === answer) {
        const index = scoreboard.findIndex(
          (score) => score.id === response.userId,
        );
        console.log(index);
        if (index !== -1) scoreboard[index].points += Number(points);
        else
          scoreboard.push({
            id: response.userId,
            username: response.username,
            points: Number(points),
          });
      }
    }
    console.log(scoreboard);
    eventData.scoreboard = scoreboard;
    console.log(eventData.scoreboard);

    // Calculate response statistics
    const totalResponses = question.responses?.length || 0;
    const correctResponses =
      question.responses?.filter((r: QuestionResponse) => r.response === answer)
        .length || 0;
    const correctPercentage =
      Math.round((correctResponses / totalResponses) * 100) || 0;

    const optionCounts = {
      optionOne:
        question.responses?.filter(
          (r: QuestionResponse) => r.response === question.optionOne,
        ).length || 0,
      optionTwo:
        question.responses?.filter(
          (r: QuestionResponse) => r.response === question.optionTwo,
        ).length || 0,
      optionThree: question.optionThree
        ? question.responses?.filter(
            (r: QuestionResponse) => r.response === question.optionThree,
          ).length || 0
        : 0,
      optionFour: question.optionFour
        ? question.responses?.filter(
            (r: QuestionResponse) => r.response === question.optionFour,
          ).length || 0
        : 0,
    };

    // Create the results embed
    const embed = {
      title: '📊 ' + question.question,
      description:
        `**Final Results**\n━━━━━━━━━━━━━━━\n\n` +
        `${question.optionOne === answer ? '✅' : '❌'} 1️⃣ ${
          question.optionOne
        }\n${createBar(
          optionCounts.optionOne,
          totalResponses,
          question.optionOne === answer,
        )} (${optionCounts.optionOne})\n\n` +
        `${question.optionTwo === answer ? '✅' : '❌'} 2️⃣ ${
          question.optionTwo
        }\n${createBar(
          optionCounts.optionTwo,
          totalResponses,
          question.optionTwo === answer,
        )} (${optionCounts.optionTwo})` +
        (question.optionThree
          ? `\n\n${question.optionThree === answer ? '✅' : '❌'} 3️⃣ ${
              question.optionThree
            }\n${createBar(
              optionCounts.optionThree,
              totalResponses,
              question.optionThree === answer,
            )} (${optionCounts.optionThree})`
          : '') +
        (question.optionFour
          ? `\n\n${question.optionFour === answer ? '✅' : '❌'} 4️⃣ ${
              question.optionFour
            }\n${createBar(
              optionCounts.optionFour,
              totalResponses,
              question.optionFour === answer,
            )} (${optionCounts.optionFour})`
          : '') +
        `\n\n📈 **Statistics**\n` +
        `Total Responses: ${totalResponses}\n` +
        `Correct Answers: ${correctResponses} (${correctPercentage}%)\n` +
        `Points Awarded: ${points} 🏆`,
      color: 0x57f287,
      ...(question.thumbnailUrl && {
        image: {
          url: question.thumbnailUrl,
        },
      }),
      footer: {
        text: `Question closed • ${correctResponses} participant${
          correctResponses !== 1 ? 's' : ''
        } earned ${points} points`,
      },
    } as APIEmbed;

    await updateMessage(interaction.channel.id, question.message, {
      embeds: [embed],
      components: [],
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: eventData,
      }),
    );

    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.log('Failed to handle answer for question', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to set answer for question, please try again',
    });
  }
};

const createBar = (
  count: number,
  totalResponses: number,
  isCorrect: boolean,
) => {
  const percentage = Math.round((count / totalResponses) * 100) || 0;
  const filledBlocks = Math.round(percentage / 10);
  const emptyBlocks = 10 - filledBlocks;
  const blocks = isCorrect
    ? '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks)
    : '▒'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `${blocks} ${percentage}%`;
};
