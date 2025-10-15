import {
  APIActionRowComponent,
  APIApplicationCommandInteractionDataStringOption,
  APIButtonComponent,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APITextChannel,
  ButtonStyle,
  ComponentType,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { Question } from "../util/interfaces";
import { v4 as uuidv4 } from "uuid";

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

    const eventId = (interaction.channel as APITextChannel).topic;
    const questionId = uuidv4();

    // const eventData = (
    //   await dynamoDbClient.send(
    //     new GetCommand({
    //       TableName: "BotTable",
    //       Key: {
    //         pk: interaction.guild_id!,
    //         sk: `event#${eventId}`,
    //       },
    //     })
    //   )
    // ).Item;

    const questionMessage = createQuestion(
      {
        question,
        optionOne,
        optionTwo,
        optionThree,
        optionFour,
      },
      eventId ?? "",
      questionId
    );

    await sendMessage(questionMessage, interaction.channel.id);
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
  const embed = { title: question.question } as APIEmbed;
  const components: APIActionRowComponent<APIButtonComponent>[] = [];
  components.push({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: question.optionOne,
        custom_id: `answer:optionOne:${eventId}:${questionId}`,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: question.optionOne,
        custom_id: `answer:optionTwo:${eventId}:${questionId}`,
      },
    ],
  });
  const optionalComponent: APIButtonComponent[] = [];
  if (question.optionThree) {
    optionalComponent.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: question.optionThree,
      custom_id: `answer:optionThree:${eventId}:${questionId}`,
    });
  }
  if (question.optionFour) {
    optionalComponent.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: question.optionFour,
      custom_id: `answer:optionFour:${eventId}:${questionId}`,
    });
  }
  components.push({
    type: ComponentType.ActionRow,
    components: optionalComponent,
  });
  return {
    embeds: [embed],
    components,
  };
};
