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
const LEADERBOARD_EMBED_COLOR = 0x5865f2;

export const handleRecruiterScore = async (
  input: APIChatInputApplicationCommandInteraction | string
) => {
  try {
    const guildId = typeof input === "string" ? input : input.guild_id!;
    const config = getConfig(guildId);
    const dataset = await compileRecruiterScoreData(guildId, config);

    const embed = buildRecruiterScoreEmbed(dataset.scores, dataset.totals, config);
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

export const handleRecruiterLeaderboard = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = interaction.guild_id!;
    const config = getConfig(guildId);
    const dataset = await compileRecruiterScoreData(guildId, config);
    const embed = buildRecruiterLeaderboardEmbed(dataset.scores);

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
    });
  } catch (err) {
    console.error(`Failed to generate recruiter leaderboard: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure generating the recruiter leaderboard, please try again or contact admins for assistance",
    });
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

interface RecruiterScoreDataset {
  scores: RecruiterScoreRow[];
  totals: ScoreTotals;
}

const compileRecruiterScoreData = async (
  guildId: string,
  config: ServerConfig
): Promise<RecruiterScoreDataset> => {
  const scoreMap = new Map<string, RecruiterScoreRow>();
  const totals: ScoreTotals = {
    ticketsClosed: 0,
    messages: 0,
    fcPostsWeek: 0,
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
  const fcMessageState = await getFcPostsMessages(
    scoreMap,
    totals,
    config,
    guildId,
    trackerState
  );

  if (
    fcMessageState.lastFcMessageId &&
    fcMessageState.lastFcMessageId !== trackerState.lastFcMessageId
  ) {
    await upsertRecruitmentTrackerState(guildId, {
      lastFcMessageId: fcMessageState.lastFcMessageId,
    });
  }

  await mergeRecruitmentPoints(scoreMap, totals, guildId);

  const scores = sortRecruiterScores(scoreMap);

  return {
    scores,
    totals,
  };
};

const getFcPostsMessages = async (
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
  stats.fcPostsWeek++;
  totals.fcPostsWeek++;

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

const buildRecruiterScoreEmbed = (
  scores: RecruiterScoreRow[],
  totals: ScoreTotals,
  config: ServerConfig
): APIEmbed => {
  const description = [
    "Weekly activity snapshot covering closed application tickets, FC posts, candidate forwards, and ✉️ DMs.",
    `Data sources: <#${config.CLAN_POSTS_CHANNEL}>, <#${config.RECRUITMENT_OPP_CHANNEL}>`,
  ].join("\n");

  return {
    title: "Recruiter Scoreboard • Last 7 Days",
    description,
    color: LEADERBOARD_EMBED_COLOR,
    fields: [
      {
        name: "Top Recruiters",
        value: formatRecruiterScoreTable(scores.slice(0, 10)),
        inline: false,
      },
      {
        name: "Totals",
        value: formatTotalsSummary(totals),
        inline: false,
      },
    ],
    footer: {
      text: "Points combine ticket, FC, candidate forward, and DM activity",
    },
    timestamp: new Date().toISOString(),
  };
};

export const buildRecruiterLeaderboardEmbed = (
  scores: RecruiterScoreRow[]
): APIEmbed => {
  const topScores = scores.slice(0, 20);
  const description = formatRecruiterLeaderboard(topScores);

  return {
    title: "Recruiter Leaderboard",
    description,
    color: LEADERBOARD_EMBED_COLOR,
    footer: {
      text: "Run /recruiter-score for the full activity breakdown",
    },
    timestamp: new Date().toISOString(),
  };
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"] as const;

const sortRecruiterScores = (
  scoreMap: Map<string, RecruiterScoreRow>
): RecruiterScoreRow[] => {
  return Array.from(scoreMap.values()).sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.messages - a.messages;
  });
};

const formatRecruiterScoreTable = (scores: RecruiterScoreRow[]): string => {
  if (scores.length === 0) {
    return "_No recruiter activity recorded in the last 7 days._";
  }

  const headers = [
    "#",
    "Recruiter",
    "Pts",
    "Ticket",
    "FC",
    "Cand",
    "Fwd",
    "DM",
    "Msgs",
  ];

  const rows = scores.map((score, index) => {
    const medal = RANK_MEDALS[index] ?? "";
    const candidatePoints =
      score.candidateForwardPoints + score.candidateDmPoints;
    return [
      String(index + 1),
      truncateDisplayName(
        medal ? `${medal} ${score.username}` : score.username,
        24
      ),
      formatNumber(score.points),
      formatNumber(score.ticketMessages),
      formatNumber(score.fcPosts),
      formatNumber(candidatePoints),
      score.candidateForwards.toString(),
      score.candidateDms.toString(),
      score.messages.toString(),
    ];
  });

  const colWidths = headers.map((header, columnIndex) => {
    return Math.max(
      header.length,
      ...rows.map((row) => row[columnIndex].length)
    );
  });

  const numericColumns = new Set([2, 3, 4, 5, 6, 7, 8]);

  const formatRow = (row: string[]) =>
    row
      .map((value, index) =>
        alignCell(value, colWidths[index], numericColumns.has(index))
      )
      .join(" ");

  const lines = [
    formatRow(headers),
    formatRow(headers.map((header, index) => "-".repeat(colWidths[index]))),
    ...rows.map(formatRow),
  ];

  return ["```text", ...lines, "```"].join("\n");
};

const formatTotalsSummary = (totals: ScoreTotals): string => {
  const candidatePoints =
    totals.candidateForwardPoints + totals.candidateDmPoints;

  const lines = [
    `• Tickets Closed: **${totals.ticketsClosed}**`,
    `• Ticket Messages: **${totals.messages}**`,
    `• FC Posts Logged: **${totals.fcPostsWeek}**`,
    `• Candidate Forwards: **${totals.candidateForwards}**`,
    `• Candidate ✉️ Reactions: **${totals.candidateDms}**`,
    `• Ticket Msg Points: **${formatNumber(totals.ticketMessages)}**`,
    `• FC Post Points: **${formatNumber(totals.fcPosts)}**`,
    `• Candidate Points: **${formatNumber(candidatePoints)}**`,
    `• Total Recruitment Points: **${formatNumber(totals.points)}**`,
  ];

  return lines.join("\n");
};

const formatRecruiterLeaderboard = (
  scores: RecruiterScoreRow[]
): string => {
  if (scores.length === 0) {
    return "*No recruiter activity recorded in the last 7 days.*";
  }

  return scores
    .map((score, index) => {
      const medal = RANK_MEDALS[index] ?? `#${index + 1}`;
      return `${medal} <@${score.userId}> — **${formatNumber(
        score.points
      )}** pts`;
    })
    .join("\n");
};

const alignCell = (value: string, width: number, rightAlign: boolean) => {
  return rightAlign ? value.padStart(width) : value.padEnd(width);
};

const truncateDisplayName = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
};

const formatNumber = (value: number): string => {
  if (Number.isNaN(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(1);
};

interface RecruiterScoreRow {
  userId: string;
  username: string;
  messages: number;
  fcPostsWeek: number;
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
  fcPostsWeek: number;
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
    fcPostsWeek: 0,
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
