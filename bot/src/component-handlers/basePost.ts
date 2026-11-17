import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  BASE_POST_BUTTONS,
  BasePostRecord,
  buildBasePostPayload,
  isBasePostRecord,
} from "../util/basePost";

type VoteChoice = "positive" | "negative";

export const handleBasePostComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const guildId = interaction.guild_id;
    if (!guildId) {
      await respond(interaction, "Base post buttons only work in a server.");
      return;
    }

    const basePost = await getBasePost(guildId, interaction.message.id);
    if (!basePost) {
      await respond(interaction, "This base post is no longer available.");
      return;
    }

    const action = interaction.data.custom_id;
    if (action === BASE_POST_BUTTONS.link) {
      await handleLinkClick(interaction, basePost);
      return;
    }

    if (
      action === BASE_POST_BUTTONS.positiveVote ||
      action === BASE_POST_BUTTONS.negativeVote
    ) {
      const userId =
        interaction.member?.user?.id ?? interaction.user?.id;
      if (!userId) {
        await respond(interaction, "I couldn't identify your Discord account.");
        return;
      }

      const choice: VoteChoice =
        action === BASE_POST_BUTTONS.positiveVote ? "positive" : "negative";
      const changed = await saveVote(guildId, basePost.messageId, userId, choice);
      const updatedPost = await getBasePost(guildId, basePost.messageId);
      if (!updatedPost) {
        throw new Error("Base post disappeared after its vote was saved.");
      }

      try {
        await updateMessage(
          updatedPost.channelId,
          updatedPost.messageId,
          buildBasePostPayload(updatedPost)
        );
      } catch (err) {
        console.error("Failed to refresh base-post vote counts", err);
        await respond(
          interaction,
          "Your vote was saved, but I couldn't refresh the displayed totals."
        );
        return;
      }

      await respond(
        interaction,
        changed ? "Your vote has been recorded." : "Your vote is already recorded."
      );
      return;
    }

    await respond(interaction, "Unknown base post action.");
  } catch (err) {
    console.error("Failed to handle base post button", err);
    await respond(
      interaction,
      "I couldn't process that action. Please try again."
    );
  }
};

const handleLinkClick = async (
  interaction: APIMessageComponentInteraction,
  basePost: BasePostRecord
) => {
  await dynamoDbClient.send(
    new UpdateCommand({
      TableName: "BotTable",
      Key: {
        pk: basePost.guildId,
        sk: `base-post#${basePost.messageId}`,
      },
      UpdateExpression: "SET downloads = downloads + :one",
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      ExpressionAttributeValues: {
        ":one": 1,
      },
    })
  );

  const updatedPost = await getBasePost(basePost.guildId, basePost.messageId);
  if (!updatedPost) {
    throw new Error("Base post disappeared after its download was recorded.");
  }

  let displayUpdated = true;
  try {
    await updateMessage(
      updatedPost.channelId,
      updatedPost.messageId,
      buildBasePostPayload(updatedPost)
    );
  } catch (err) {
    displayUpdated = false;
    console.error("Failed to refresh base-post download count", err);
  }

  await respond(
    interaction,
    displayUpdated
      ? `Copy this base link:\n${updatedPost.baseLink}`
      : `Copy this base link:\n${updatedPost.baseLink}\n\nThe download was counted, but I couldn't refresh the displayed total.`
  );
};

const saveVote = async (
  guildId: string,
  messageId: string,
  userId: string,
  choice: VoteChoice
): Promise<boolean> => {
  const voteKey = {
    pk: guildId,
    sk: `base-post-vote#${messageId}#${userId}`,
  };
  const basePostKey = {
    pk: guildId,
    sk: `base-post#${messageId}`,
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existingVote = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: voteKey,
        ConsistentRead: true,
      })
    );
    const storedChoice = existingVote.Item?.vote;
    const previousChoice: VoteChoice | undefined =
      storedChoice === "positive" || storedChoice === "negative"
        ? storedChoice
        : undefined;

    if (existingVote.Item && !previousChoice) {
      throw new Error("Stored base-post vote is invalid.");
    }
    if (previousChoice === choice) {
      return false;
    }

    const positiveDelta =
      (choice === "positive" ? 1 : 0) -
      (previousChoice === "positive" ? 1 : 0);
    const negativeDelta =
      (choice === "negative" ? 1 : 0) -
      (previousChoice === "negative" ? 1 : 0);

    try {
      await dynamoDbClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: "BotTable",
                Key: basePostKey,
                UpdateExpression:
                  "SET positiveVotes = positiveVotes + :positiveDelta, negativeVotes = negativeVotes + :negativeDelta",
                ConditionExpression:
                  "attribute_exists(pk) AND attribute_exists(sk)",
                ExpressionAttributeValues: {
                  ":positiveDelta": positiveDelta,
                  ":negativeDelta": negativeDelta,
                },
              },
            },
            previousChoice
              ? {
                  Update: {
                    TableName: "BotTable",
                    Key: voteKey,
                    UpdateExpression: "SET #vote = :choice",
                    ConditionExpression: "#vote = :previousChoice",
                    ExpressionAttributeNames: { "#vote": "vote" },
                    ExpressionAttributeValues: {
                      ":choice": choice,
                      ":previousChoice": previousChoice,
                    },
                  },
                }
              : {
                  Put: {
                    TableName: "BotTable",
                    Item: { ...voteKey, vote: choice },
                    ConditionExpression:
                      "attribute_not_exists(pk) AND attribute_not_exists(sk)",
                  },
                },
          ],
        })
      );
      return true;
    } catch (err) {
      if (err instanceof TransactionCanceledException && attempt < 2) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Base-post vote changed repeatedly; please try again.");
};

const getBasePost = async (
  guildId: string,
  messageId: string
): Promise<BasePostRecord | null> => {
  const result = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: `base-post#${messageId}`,
      },
      ConsistentRead: true,
    })
  );

  return isBasePostRecord(result.Item) ? result.Item : null;
};

const respond = async (
  interaction: APIMessageComponentInteraction,
  content: string
) =>
  updateResponse(interaction.application_id, interaction.token, {
    content,
    flags: 64,
  });
