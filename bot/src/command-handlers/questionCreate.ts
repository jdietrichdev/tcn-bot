import {
  APIActionRowComponent,
  APIApplicationCommandInteractionDataStringOption,
  APIButtonComponent,
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataAttachmentOption,
  APIEmbed,
  APITextChannel,
  ButtonStyle,
  ComponentType,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import {
  deleteResponse,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { Question } from "../util/interfaces";
import { v4 as uuidv4 } from "uuid";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const handleQuestionCreate = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const question =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "question"
      ).value;
    const optionOne =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "option1"
      ).value;
    const optionTwo =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "option2"
      ).value;
    const optionThree =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "option3"
      )?.value;
    const optionFour =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "option4"
      )?.value;
    const thumbnail =
      getCommandOptionData<APIApplicationCommandInteractionDataAttachmentOption>(
        interaction,
        "thumbnail"
      )?.value;

    const thumbnailUrl = thumbnail
      ? interaction.data.resolved?.attachments?.[thumbnail]?.url
      : undefined;

    const eventId = (interaction.channel as APITextChannel).topic;
    const questionId = uuidv4();

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

    const questionMessage = createQuestion(
      {
        question,
        optionOne,
        optionTwo,
        optionThree,
        optionFour,
        thumbnailUrl,
      },
      eventId ?? "",
      questionId
    );

    const message = await sendMessage(questionMessage, interaction.channel.id);

    const questions = eventData.questions ?? [];
    questions.push({
      id: questionId,
      message: message.id,
      question,
      optionOne,
      optionTwo,
      optionThree,
      optionFour,
      responses: [],
      thumbnail: thumbnailUrl,
    });
    eventData.questions = questions;

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: eventData,
      })
    );

    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.log("Failure creating question", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Failed to create question, please try again or contact admin",
    });
  }
};

const createQuestion = (
  question: Question,
  eventId: string,
  questionId: string
): RESTPostAPIWebhookWithTokenJSONBody => {
  const embed = {
    title: "📊 " + question.question,
    description:
      `**Response Distribution**\n━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ ${question.optionOne}\n░░░░░░░░░░ 0%\n\n` +
      `2️⃣ ${question.optionTwo}\n░░░░░░░░░░ 0%\n` +
      (question.optionThree
        ? `\n3️⃣ ${question.optionThree}\n░░░░░░░░░░ 0%`
        : "") +
      (question.optionFour
        ? `\n4️⃣ ${question.optionFour}\n░░░░░░░░░░ 0%`
        : "") +
      `\n\n📊 **Total Responses:** 0`,
    color: 0x6b65f2, // More purple variant of Discord blurple
    ...(question.thumbnailUrl && {
      image: {
        url: question.thumbnailUrl,
      },
    }),
    footer: {
      text: "Click a button below to submit your answer • You can change your answer at any time",
    },
  } as APIEmbed;
  const components: APIActionRowComponent<APIButtonComponent>[] = [];
  components.push({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: "1️⃣ " + question.optionOne,
        custom_id: `answer_optionOne_${eventId}_${questionId}`,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: "2️⃣ " + question.optionTwo,
        custom_id: `answer_optionTwo_${eventId}_${questionId}`,
      },
    ],
  });
  const optionalComponent: APIButtonComponent[] = [];
  if (question.optionThree) {
    optionalComponent.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "3️⃣ " + question.optionThree,
      custom_id: `answer_optionThree_${eventId}_${questionId}`,
    });
  }
  if (question.optionFour) {
    optionalComponent.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "4️⃣ " + question.optionFour,
      custom_id: `answer_optionFour_${eventId}_${questionId}`,
    });
  }
  if (optionalComponent.length !== 0) {
    components.push({
      type: ComponentType.ActionRow,
      components: optionalComponent,
    });
  }
  return {
    embeds: [embed],
    components,
  };
};
