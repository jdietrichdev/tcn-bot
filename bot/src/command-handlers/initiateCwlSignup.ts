import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { buildCwlRosterMessage, isCwlSignupRecord } from "../util/cwlSignup";

export const handleInitiateCwlSignup = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const signupName =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "name"
    ).value;
  const channelId = interaction.channel_id;
  if (!interaction.guild_id || !channelId) {
    throw new Error("CWL signups must be started in a server text channel.");
  }

  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id,
        sk: `signup#${signupName}`,
      },
    })
  );
  const signupItem: unknown = response.Item;
  if (
    !isCwlSignupRecord(signupItem) ||
    signupItem.clans.length === 0
  ) {
    throw new Error(
      `No clans are configured for "${signupName}". Add clans with /cwl-add-clan first.`
    );
  }
  const signup = signupItem;
  if (signup["message"]) {
    throw new Error(
      `CWL signup "${signupName}" uses the previous single-message format. Create a new signup name for per-clan rosters.`
    );
  }

  signup.channelId = signup.channelId ?? channelId;
  signup.status = "open";
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: signup,
    })
  );

  let createdCount = 0;
  for (const clan of signup.clans) {
    clan.accounts = Array.isArray(clan.accounts) ? clan.accounts : [];
    const message = buildCwlRosterMessage(signupName, clan);

    if (clan.messageId) {
      await updateMessage(signup.channelId, clan.messageId, message);
      continue;
    }

    const postedMessage = await sendMessage(message, signup.channelId);
    clan.messageId = postedMessage.id;
    createdCount += 1;
    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: signup,
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  await updateResponse(interaction.application_id, interaction.token, {
    content: `CWL roster signups are posted in <#${signup.channelId}>. Created ${createdCount} new roster${createdCount === 1 ? "" : "s"}.`,
  });
};
