import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  MessageType,
} from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import {
  getChannelMessages,
  getMessageReaction,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import {
  fetchRecruitmentPoints,
  getRecruitmentTrackerState,
  incrementRecruitmentPoints,
  upsertRecruitmentTrackerState,
  RecruitmentTrackerState,
} from "../util/recruitmentTracker";

export const handleRecruiterScore = async (
  input: APIChatInputApplicationCommandInteraction | string
) => {
  try {
    const guildId = typeof input === "string" ? input : input.guild_id!;
    const config = getConfig(guildId);
    const scoreMap = new Map<string, RecruiterScoreRow>();
    const totals: ScoreTotals = {
      candidateForwards: 0,
      messages: 0,
      clanPosts: 0,
      ticketMessages: 0,
      fcPosts: 0,
      points: 0,
    };

    await getCandidatesMessages(scoreMap, totals, config);

    const trackerState = await getRecruitmentTrackerState(guildId);
    const clanMessageState = await getClanPostsMessages(
      scoreMap,
      totals,
      config,
      guildId,
      trackerState
    );

    if (
      clanMessageState.lastFcMessageId &&
      clanMessageState.lastFcMessageId !== trackerState.lastFcMessageId
    ) {
      await upsertRecruitmentTrackerState(guildId, {
        lastFcMessageId: clanMessageState.lastFcMessageId,
      });
    }

    await mergeRecruitmentPoints(scoreMap, totals, guildId);

    console.log(JSON.stringify(Array.from(scoreMap.values())));
    const embed = buildEmbed(scoreMap, totals, config);
    await sendMessage(
      {
        embeds: [embed],
      },
      config.RECRUITER_CHANNEL
    );
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content: `Information has been compiled and sent to <#${config.RECRUITER_CHANNEL}>`,
      });
    } else {
      await sendMessage(
        {
          embeds: [embed],
        },
        config.RECRUITMENT_LEADERBOARD_CHANNEL
      );
    }
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content:
          "There was a failure generating the recruitment score, please try again or contact admins for assistance",
      });
    } else {
      throw new Error("Failure generating recruitment score");
    }
  }
};

const getCandidatesMessages = async (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  config: ServerConfig
) => {
  const messages = await getChannelMessages(
    config.RECRUITMENT_OPP_CHANNEL,
    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
  );
  for (const message of messages) {
    if (message.type === MessageType.Default && message.message_reference) {
      totals.candidateForwards++;
      const forwarderStats = ensureRecruiterRecord(
        scoreMap,
        message.author.id,
        resolveUserDisplayName(
          message.author.id,
          message.author.username,
          message.author.global_name ?? undefined
        )
      );
      forwarderStats.messages++;
      totals.messages++;
      if (message.reactions?.some((reaction) => reaction.emoji.name === `✉️`)) {
        const userReactions = await getMessageReaction(
          message.channel_id,
          message.id,
          `✉️`
        );
        for (const user of userReactions) {
          if (user.id !== message.author.id && !user.bot) {
            const stats = ensureRecruiterRecord(
              scoreMap,
              user.id,
              resolveUserDisplayName(
                user.id,
                user.username,
                user.global_name ?? undefined
              )
            );
            stats.messages++;
            totals.messages++;
          }
        }
      }
    }
  }
};

const getClanPostsMessages = async (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  config: ServerConfig,
  guildId: string,
  trackerState: RecruitmentTrackerState
): Promise<{ lastFcMessageId?: string }> => {
  const messages = await getChannelMessages(
    config.CLAN_POSTS_CHANNEL,
    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
  );
  const lastProcessedId = trackerState.lastFcMessageId
    ? BigInt(trackerState.lastFcMessageId)
    : null;
  let maxProcessedId = lastProcessedId;
  const fcPostCounts = new Map<string, { username: string; count: number }>();

  for (const message of messages) {
    if (
      message.type === MessageType.Default &&
      message.content.startsWith(
        "https://discord.com/channels/236523452230533121/1058589765508800644"
      ) &&
      !message.message_reference &&
      message.embeds.length !== 0
    ) {
      const stats = ensureRecruiterRecord(
        scoreMap,
        message.author.id,
        resolveUserDisplayName(
          message.author.id,
          message.author.username,
          message.author.global_name ?? undefined
        )
      );
      stats.clanPosts++;
      totals.clanPosts++;

      const messageIdBigInt = BigInt(message.id);
      const isNewMessage =
        lastProcessedId === null || messageIdBigInt > lastProcessedId;

      if (isNewMessage) {
        const existing = fcPostCounts.get(message.author.id) || {
          username: resolveUserDisplayName(
            message.author.id,
            message.author.username,
            message.author.global_name ?? undefined
          ),
          count: 0,
        };
        existing.username = resolveUserDisplayName(
          message.author.id,
          message.author.username,
          message.author.global_name ?? undefined
        );
        existing.count++;
        fcPostCounts.set(message.author.id, existing);

        if (!maxProcessedId || messageIdBigInt > maxProcessedId) {
          maxProcessedId = messageIdBigInt;
        }
      }
    }
  }

  if (fcPostCounts.size > 0) {
    await Promise.all(
      Array.from(fcPostCounts.entries()).map(([userId, details]) =>
        incrementRecruitmentPoints(guildId, userId, details.username, {
          fcPosts: details.count,
        })
      )
    );
  }

  return {
    lastFcMessageId:
      maxProcessedId && maxProcessedId !== lastProcessedId
        ? maxProcessedId.toString()
        : trackerState.lastFcMessageId,
  };
};

const buildEmbed = (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  config: ServerConfig
) => {
  const sortedScores = Array.from(scoreMap.values()).sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.messages - a.messages;
  });

  return {
    title: "Recruiter Scoring for Last Week",
    description: `Scores based on <#${config.RECRUITMENT_OPP_CHANNEL}> and <#${config.CLAN_POSTS_CHANNEL}>`,
    fields: sortedScores.map((value) => {
      return {
        name: `**${value.username}**`,
        value: [
          `User: <@${value.userId}>`,
          `Recruitment Points: ${value.points}`,
          `Ticket Msg Points: ${value.ticketMessages}`,
          `FC Post Points: ${value.fcPosts}`,
          `Messages (7d): ${value.messages}`,
          `Clan Posts (7d): ${value.clanPosts}`,
        ].join("\n"),
      };
    }),
    footer: {
      text: [
        "TOTALS:",
        `Candidate Forwards: ${totals.candidateForwards}`,
        `Messages Sent: ${totals.messages}`,
        `Clan Posts: ${totals.clanPosts}`,
        `Ticket Msg Points: ${totals.ticketMessages}`,
        `FC Post Points: ${totals.fcPosts}`,
        `Total Recruitment Points: ${totals.points}`,
      ].join("\n"),
    },
  } as APIEmbed;
};

interface RecruiterScoreRow {
  userId: string;
  username: string;
  messages: number;
  clanPosts: number;
  ticketMessages: number;
  fcPosts: number;
  points: number;
}

interface ScoreTotals {
  candidateForwards: number;
  messages: number;
  clanPosts: number;
  ticketMessages: number;
  fcPosts: number;
  points: number;
}

const ensureRecruiterRecord = (
  scoreMap: Map<string, RecruiterScoreRow>,
  userId: string,
  username: string
): RecruiterScoreRow => {
  const existing = scoreMap.get(userId);
  if (existing) {
    if (username && existing.username !== username) {
      existing.username = username;
    }
    return existing;
  }

  const record: RecruiterScoreRow = {
    userId,
    username,
    messages: 0,
    clanPosts: 0,
    ticketMessages: 0,
    fcPosts: 0,
    points: 0,
  };
  scoreMap.set(userId, record);
  return record;
};

const resolveUserDisplayName = (
  userId: string,
  username?: string,
  globalName?: string
) => username ?? globalName ?? userId;

const mergeRecruitmentPoints = async (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  guildId: string
) => {
  const pointsItems = await fetchRecruitmentPoints(guildId);

  totals.ticketMessages = 0;
  totals.fcPosts = 0;
  totals.points = 0;

  for (const item of pointsItems) {
    const record = ensureRecruiterRecord(
      scoreMap,
      item.userId,
      item.username ?? item.userId
    );
    record.ticketMessages = item.ticketMessages ?? 0;
    record.fcPosts = item.fcPosts ?? 0;
    record.points =
      item.points ?? record.ticketMessages + record.fcPosts;

    totals.ticketMessages += record.ticketMessages;
    totals.fcPosts += record.fcPosts;
    totals.points += record.points;
  }
};
