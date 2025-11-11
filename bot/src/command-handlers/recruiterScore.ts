import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APIMessage,
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
  fetchTicketRecruiterStats,
  upsertRecruitmentTrackerState,
  RecruitmentTrackerState,
} from "../util/recruitmentTracker";

const MAIL_REACTION_EMOJI = "✉️";
const MAIL_REACTION_QUERY = encodeURIComponent(MAIL_REACTION_EMOJI);
const CANDIDATE_FORWARD_POINT_VALUE = 1;
const CANDIDATE_DM_POINT_VALUE = 1;

export const handleRecruiterScore = async (
  input: APIChatInputApplicationCommandInteraction | string
) => {
  try {
    const guildId = typeof input === "string" ? input : input.guild_id!;
    const config = getConfig(guildId);
    const scoreMap = new Map<string, RecruiterScoreRow>();
    const totals: ScoreTotals = {
      ticketsClosed: 0,
      messages: 0,
      clanPosts: 0,
      ticketMessages: 0,
      fcPosts: 0,
      points: 0,
      candidateForwards: 0,
      candidateDms: 0,
      candidateForwardPoints: 0,
      candidateDmPoints: 0,
    };

    await applyRecentTicketStats(scoreMap, totals, guildId);
    await collectCandidateChannelActivity(scoreMap, totals, config);

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

const applyRecentTicketStats = async (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  guildId: string
) => {
  const since = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
  const ticketStats = await fetchTicketRecruiterStats(guildId, since);

  totals.ticketsClosed += ticketStats.length;

  for (const record of ticketStats) {
    for (const participant of record.recruiterMessages) {
      const stats = ensureRecruiterRecord(
        scoreMap,
        participant.userId,
        participant.username
      );
      stats.messages += participant.count;
      totals.messages += participant.count;
    }
  }
};

const collectCandidateChannelActivity = async (
  scoreMap: Map<string, RecruiterScoreRow>,
  totals: ScoreTotals,
  config: ServerConfig
) => {
  const since = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
  const messages = await getChannelMessages(
    config.RECRUITMENT_OPP_CHANNEL,
    since
  );

  for (const message of messages) {
    if (message.author.bot) {
      continue;
    }

    if (message.message_reference) {
      const forwarder = ensureRecruiterRecord(
        scoreMap,
        message.author.id,
        resolveUserDisplayName(
          message.author.id,
          message.author.username,
          message.author.global_name ?? undefined
        )
      );
      forwarder.candidateForwards++;
      totals.candidateForwards++;
          forwarder.candidateForwardPoints += CANDIDATE_FORWARD_POINT_VALUE;
          totals.candidateForwardPoints += CANDIDATE_FORWARD_POINT_VALUE;
    }

    const mailReaction = message.reactions?.find(
      (reaction) => reaction.emoji?.name === MAIL_REACTION_EMOJI
    );

    if (!mailReaction) {
      continue;
    }

    const reactors = await getMessageReaction(
      config.RECRUITMENT_OPP_CHANNEL,
      message.id,
      MAIL_REACTION_QUERY
    );

    for (const reactor of reactors) {
      if (reactor.bot || reactor.id === config.BOT_ID) {
        continue;
      }

      const dmCredit = ensureRecruiterRecord(
        scoreMap,
        reactor.id,
        resolveUserDisplayName(
          reactor.id,
          reactor.username,
          reactor.global_name ?? undefined
        )
      );
      dmCredit.candidateDms++;
      totals.candidateDms++;
      dmCredit.candidateDmPoints += CANDIDATE_DM_POINT_VALUE;
      totals.candidateDmPoints += CANDIDATE_DM_POINT_VALUE;
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
    if (isFcPostMessage(message)) {
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
          points: details.count * 2,
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

const isFcPostMessage = (message: APIMessage): boolean => {
  if (message.type !== MessageType.Default) {
    return false;
  }

  if (message.author.bot) {
    return false;
  }

  if (message.message_reference) {
    return false;
  }

  const content = message.content?.trim();
  if (!content) {
    return false;
  }

  if (content.startsWith("https://discord.com/channels/236523452230533121/1058589765508800644")) {
    return true;
  }

  if (/^(✅|❌|🎟)\s*[-:]/i.test(content)) {
    return true;
  }

  if (/^fc\s*(trial|result)/i.test(content)) {
    return true;
  }

  if (/^trial\s*result/i.test(content)) {
    return true;
  }

  if (/^base\s*1/i.test(content)) {
    return true;
  }

  return false;
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
  description: `Scores based on closed application tickets and <#${config.CLAN_POSTS_CHANNEL}>`,
    fields: sortedScores.map((value) => {
      return {
        name: `**${value.username}**`,
        value: [
          `User: <@${value.userId}>`,
          `Recruitment Points: ${value.points}`,
          `Ticket Msg Points: ${value.ticketMessages}`,
          `FC Post Points: ${value.fcPosts}`,
          `Ticket Msgs (7d): ${value.messages}`,
          `Clan Posts (7d): ${value.clanPosts}`,
          `Candidate Forwards (7d): ${value.candidateForwards}`,
          `Candidate DM Reactions (7d): ${value.candidateDms}`,
          `Candidate Points (7d): ${
            value.candidateForwardPoints + value.candidateDmPoints
          }`,
        ].join("\n"),
      };
    }),
    footer: {
      text: [
        "TOTALS:",
  `Tickets Closed (7d): ${totals.ticketsClosed}`,
        `Ticket Messages (7d): ${totals.messages}`,
        `Clan Posts: ${totals.clanPosts}`,
        `Candidate Forwards: ${totals.candidateForwards}`,
        `Candidate DM Reactions: ${totals.candidateDms}`,
        `Candidate Points (7d): ${
          totals.candidateForwardPoints + totals.candidateDmPoints
        }`,
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
  candidateForwards: number;
  candidateDms: number;
  candidateForwardPoints: number;
  candidateDmPoints: number;
  ticketMessages: number;
  fcPosts: number;
  points: number;
}

interface ScoreTotals {
  ticketsClosed: number;
  messages: number;
  clanPosts: number;
  candidateForwards: number;
  candidateDms: number;
  candidateForwardPoints: number;
  candidateDmPoints: number;
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
    candidateForwards: 0,
    candidateDms: 0,
    candidateForwardPoints: 0,
    candidateDmPoints: 0,
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

  const processedUsers = new Set<string>();

  for (const item of pointsItems) {
    const record = ensureRecruiterRecord(
      scoreMap,
      item.userId,
      item.username ?? item.userId
    );
    record.ticketMessages = item.ticketMessages ?? 0;
    record.fcPosts = item.fcPosts ?? 0;
    const basePoints = item.points ?? record.ticketMessages + record.fcPosts;
    const candidatePoints =
      record.candidateForwardPoints + record.candidateDmPoints;
    record.points = basePoints + record.messages + candidatePoints;

    totals.ticketMessages += record.ticketMessages;
    totals.fcPosts += record.fcPosts;
    totals.points += record.points;
    processedUsers.add(record.userId);
  }

  for (const record of scoreMap.values()) {
    if (processedUsers.has(record.userId)) {
      continue;
    }
    const candidatePoints =
      record.candidateForwardPoints + record.candidateDmPoints;
    record.points = record.messages + candidatePoints;
    totals.points += record.points;
  }
};
