import {
  APIApplicationCommandInteractionDataAttachmentOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { DeleteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  createForumThread,
  deleteChannel,
  deleteMessage,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getCommandOptionData } from "../util/interaction-util";
import {
  BasePostRecord,
  buildBasePostEmbeds,
  buildBasePostPayload,
  getRecommendedLeagueEmojiKey,
  loadBasePostLeagueEmojiMap,
} from "../util/basePost";
import {
  ClanCastleTroopInputError,
  loadClanCastleTroopEmojiMap,
  parseClanCastleTroops,
} from "../util/clanCastleTroops";
import type { ClanCastleTroop } from "../util/clanCastleTroops";
import { getConfig } from "../util/serverConfig";

export const handleBasePost = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const baseLink =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "base_link"
    ).value;
  const clanCastle =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "clan_castle"
    ).value;
  const league =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "league"
    ).value;
  const imageId =
    getCommandOptionData<APIApplicationCommandInteractionDataAttachmentOption>(
      interaction,
      "image"
    ).value;
  const notes =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "notes"
    )?.value;

  if (!interaction.guild_id) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Base posts can only be created in a server.",
      flags: 64,
    });
    return;
  }

  let clanCastleTroops: ClanCastleTroop[];
  try {
    clanCastleTroops = parseClanCastleTroops(clanCastle);
  } catch (err) {
    if (!(err instanceof ClanCastleTroopInputError)) {
      throw err;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: err.message,
      flags: 64,
    });
    return;
  }

  let linkUrl: URL;
  try {
    linkUrl = new URL(baseLink);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Please provide a valid Clash of Clans base link.",
      flags: 64,
    });
    return;
  }

  if (
    linkUrl.protocol !== "https:" ||
    linkUrl.hostname !== "link.clashofclans.com"
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "The base link must be an HTTPS link from link.clashofclans.com.",
      flags: 64,
    });
    return;
  }

  const image = interaction.data.resolved?.attachments?.[imageId];
  if (
    !image ||
    (image.content_type !== "image/png" &&
      !image.filename.toLowerCase().endsWith(".png"))
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "The base image must be a PNG file.",
      flags: 64,
    });
    return;
  }

  let channelId: string | undefined;
  let messageId: string | undefined;
  let feedbackThreadId: string | undefined;
  let record: BasePostRecord | undefined;
  let recordSaved = false;

  try {
    const config = getConfig(interaction.guild_id);
    channelId = config.BASE_POST_CHANNEL;
    if (!channelId) {
      throw new Error("No base-post channel is configured for this server.");
    }
    const feedbackForumId = config.BASE_POST_FEEDBACK_FORUM;
    if (!feedbackForumId) {
      throw new Error("No base-post feedback forum is configured for this server.");
    }
    const redirectBaseUrl = process.env.BASE_POST_REDIRECT_URL;
    if (!redirectBaseUrl) {
      throw new Error("No base-post redirect URL is configured.");
    }

    const troopEmojiMap = loadClanCastleTroopEmojiMap();
    const clanCastleTroopEmojiIds: Record<string, string> = {};
    for (const { slug } of clanCastleTroops) {
      const emojiId = troopEmojiMap[slug];
      if (!emojiId) {
        throw new Error(`Missing ClashKing application emoji for ${slug}.`);
      }
      clanCastleTroopEmojiIds[slug] = emojiId;
    }

    const leagueEmojiMap = loadBasePostLeagueEmojiMap();
    const leagueEmojiId =
      leagueEmojiMap[getRecommendedLeagueEmojiKey(league)];
    if (!leagueEmojiId) {
      throw new Error(`Missing ClashKing application emoji for league "${league}".`);
    }

    const counterResult = await dynamoDbClient.send(
      new UpdateCommand({
        TableName: "BotTable",
        Key: {
          pk: interaction.guild_id,
          sk: "base-post-counter",
        },
        UpdateExpression: "ADD lastBaseId :increment",
        ExpressionAttributeValues: {
          ":increment": 1,
        },
        ReturnValues: "UPDATED_NEW",
      })
    );
    const baseId: unknown = counterResult.Attributes?.lastBaseId;
    if (typeof baseId !== "number") {
      throw new Error("Failed to allocate a base post ID.");
    }

    const builderName =
      interaction.member?.user.username ??
      interaction.user?.username ??
      "Builder";
    const builderId =
      interaction.member?.user.id ?? interaction.user?.id;
    if (!builderId) {
      throw new Error("Couldn't identify the base builder.");
    }
    const basePostData: BasePostRecord = {
      guildId: interaction.guild_id,
      channelId,
      messageId: "",
      builderId,
      baseId,
      baseLink: linkUrl.toString(),
      clanCastle,
      clanCastleTroops,
      clanCastleTroopEmojiIds,
      league,
      leagueEmojiId,
      notes,
      imageUrl: image.url,
      builderName,
      downloads: 0,
      positiveVotes: 0,
      negativeVotes: 0,
    };

    const postedMessage = await sendMessage(
      { embeds: buildBasePostEmbeds(basePostData) },
      channelId
    );
    messageId = postedMessage.id;
    const forumThread = await createForumThread(feedbackForumId, {
      name: `Base #${baseId} Feedback`,
      auto_archive_duration: 4320,
      message: {
        content: `Feedback discussion for [Base #${baseId}](https://discord.com/channels/${interaction.guild_id}/${channelId}/${messageId}).`,
      },
    });
    feedbackThreadId = forumThread.id;
    if (!feedbackThreadId) {
      throw new Error("Discord did not return the feedback forum thread ID.");
    }

    record = {
      ...basePostData,
      messageId,
      feedbackThreadId,
    };

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: {
          pk: interaction.guild_id,
          sk: `base-post#${messageId}`,
          ...record,
        },
      })
    );
    recordSaved = true;

    await updateMessage(
      channelId,
      messageId,
      buildBasePostPayload(record, redirectBaseUrl)
    );
  } catch (err) {
    console.error("Failed to post base layout", err);

    if (feedbackThreadId) {
      try {
        await deleteChannel(feedbackThreadId);
      } catch (cleanupError) {
        console.error("Failed to clean up base-post feedback thread", cleanupError);
      }
    }
    if (channelId && messageId) {
      try {
        await deleteMessage(channelId, messageId);
      } catch (cleanupError) {
        console.error("Failed to clean up incomplete base post", cleanupError);
      }
    }
    if (recordSaved && messageId) {
      try {
        await dynamoDbClient.send(
          new DeleteCommand({
            TableName: "BotTable",
            Key: {
              pk: interaction.guild_id,
              sk: `base-post#${messageId}`,
            },
          })
        );
      } catch (cleanupError) {
        console.error("Failed to remove incomplete base-post record", cleanupError);
      }
    }

    try {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "I couldn't post the base. Please try again or contact an admin.",
        flags: 64,
      });
    } catch (responseError) {
      console.error("Failed to send base-post failure response", responseError);
    }
    return;
  }

  await updateResponse(interaction.application_id, interaction.token, {
    content: `Your base has been posted in <#${channelId}>.`,
    flags: 64,
  });
};
