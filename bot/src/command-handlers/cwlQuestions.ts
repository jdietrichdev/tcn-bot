import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { BUTTONS } from "../component-handlers/buttons";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const handleCwlQuestions = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const questionName =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "name"
      ).value;

    try {
      await dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: {
            pk: interaction.guild_id!,
            sk: `questions#${questionName}`,
            questionName,
            accounts: [],
          },
          ConditionExpression:
            "attribute_not_exists(pk) and attribute_not_exists(sk)",
        })
      );
    } catch (err) {
      if (!(err as Error).message.includes("conditional request")) {
        throw err;
      }
    }

    await sendMessage(
      {
        embeds: [
          {
            title: questionName,
            description:
              "Make sure you sign up for the CWL roster with the green button above. These questions are optional but will help us to provide the best CWL experience we can.",
          },
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [BUTTONS.CWL_QUESTIONS, BUTTONS.EXPORT_CWL_QUESTIONS],
          },
        ],
      },
      config.CWL_SIGNUP_CHANNEL
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: "CWL questions has been started",
    });
  } catch (err) {
    console.log(`Failed to initiate CWL questions: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "Failed initiating CWL questionnaire, try again or contact admins",
    });
  }
};
