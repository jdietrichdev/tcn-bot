import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";

export const handleCwlMonthStart = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  const monthOption = interaction.data.options?.find(
    (option) => option.name === "month"
  ) as APIApplicationCommandInteractionDataStringOption | undefined;
  const month = monthOption?.value;

  if (!guildId) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ This command can only be used in a server.",
    });
  }

  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Enter the CWL month in YYYY-MM format (for example, 2026-12).",
    });
  }

  try {
    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: {
          pk: guildId,
          sk: `cwl-month#${month}`,
          month,
          status: "open",
          createdAt: new Date().toISOString(),
          createdBy: interaction.member?.user?.id,
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );

    return updateResponse(interaction.application_id, interaction.token, {
      content: `✅ CWL management is open for **${month}**. Create monthly clan rosters with \`/create-roster\`.`,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ CWL management has already been started for **${month}**.`,
      });
    }

    console.error("Failed to start CWL month:", error);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Failed to start CWL management. Please try again or contact an admin.",
    });
  }
};
