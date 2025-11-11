import {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIEmbed,
  APIMessageActionRowComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import {
  LEADERBOARD_EMBED_COLOR,
  RecruiterScoreRow,
  ScoreTotals,
  TICKET_MESSAGE_POINT_VALUE,
} from "./recruiterScoreShared";

const RANK_MEDALS = ["🥇", "🥈", "🥉"] as const;

export const SCORE_PAGE_SIZE = 10;

export interface RecruiterScoreDisplayContext {
  recruitmentOppChannelId: string;
  clanPostsChannelId: string;
  generatedAt: string;
}

export const buildRecruiterScorePageEmbed = (
  allScores: RecruiterScoreRow[],
  _totals: ScoreTotals,
  context: RecruiterScoreDisplayContext,
  pageIndex: number,
  totalPages: number,
  pageSize: number
): APIEmbed => {
  const start = pageIndex * pageSize;
  const end = Math.min(start + pageSize, allScores.length);
  const pageScores = allScores.slice(start, end);
  const hasScores = allScores.length > 0;

  const description =
    "Use ⏮️ ◀️ ▶️ ⏭️ to page through rankings. Totals summary on the final page.";
  const formattedRows = hasScores ? formatRecruiterScoreTable(pageScores, start) : [];

  const fieldTitleBase = hasScores
    ? `Recruiter Rankings • Ranks ${start + 1}-${end}`
    : "Recruiter Rankings";

  const rankingFields = hasScores
    ? chunkEntries(formattedRows).map((value, index) => ({
        name: index === 0 ? fieldTitleBase : `${fieldTitleBase} (cont.)`,
        value,
        inline: false,
      }))
    : [
        {
          name: fieldTitleBase,
          value: "_No recruiter activity recorded in the last 7 days._",
          inline: false,
        },
      ];

  return {
    title: "Recruiter Scoreboard • Last 7 Days",
    description,
    color: LEADERBOARD_EMBED_COLOR,
    fields: rankingFields,
    footer: {
      text: `Page ${pageIndex + 1} of ${totalPages}`,
    },
    timestamp: context.generatedAt,
  };
};

export const buildRecruiterTotalsEmbed = (
  totals: ScoreTotals,
  context: RecruiterScoreDisplayContext,
  pageIndex: number,
  totalPages: number
): APIEmbed => {
  const candidatePoints =
    totals.candidateForwardPoints + totals.candidateDmPoints;
  const ticketMessagePoints =
    totals.ticketMessages * TICKET_MESSAGE_POINT_VALUE;
  const averageMessagesPerTicket =
    totals.ticketsClosed > 0
      ? totals.messages / totals.ticketsClosed
      : 0;
  const fcWeekPoints = totals.fcPostsWeek * 2;

  return {
    title: "Recruitment Totals Overview",
    description: [
      "Weekly aggregate metrics across tickets, FC posts, and candidate outreach.",
      `Data sources: <#${context.clanPostsChannelId}>, <#${context.recruitmentOppChannelId}>`,
    ].join("\n"),
    color: LEADERBOARD_EMBED_COLOR,
    fields: [
      {
        name: "Candidate Stats",
        value: [
          `Forwards: **${totals.candidateForwards}** (+${formatNumber(
            totals.candidateForwardPoints
          )} pts)`,
          `✉️ DMs: **${totals.candidateDms}** (+${formatNumber(
            totals.candidateDmPoints
          )} pts)`,
          `Candidate Points: **${formatNumber(candidatePoints)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Ticket Stats",
        value: [
          `Tickets Closed: **${totals.ticketsClosed}**`,
          `Recruiter Messages: **${totals.messages}**`,
          `Ticket Msg Points: **${formatNumber(ticketMessagePoints)}**`,
          `Avg Msgs/Ticket: **${formatNumber(averageMessagesPerTicket)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "FC Stats",
        value: [
          `Posts (7d): **${totals.fcPostsWeek}**`,
          `Points (7d @2 ea): **${formatNumber(fcWeekPoints)}**`,
          `Ledger FC Points: **${formatNumber(totals.fcPosts)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Overall Points",
        value: [
          `Total Recruitment Points: **${formatNumber(totals.points)}**`,
          `Candidate Points: **${formatNumber(candidatePoints)}**`,
          `Ticket Msg Points: **${formatNumber(ticketMessagePoints)}**`,
        ].join("\n"),
        inline: false,
      },
    ],
    footer: {
      text: `Page ${pageIndex + 1} of ${totalPages}`,
    },
    timestamp: context.generatedAt,
  };
};

export const formatRecruiterScoreTable = (
  scores: RecruiterScoreRow[],
  startIndex = 0
): string[] => {
  if (scores.length === 0) {
    return [];
  }

  return scores.map((score, index) => {
    const rank = startIndex + index + 1;
    const prefix = RANK_MEDALS[startIndex + index] ?? `#${rank}`;
    const candidatePoints =
      score.candidateForwardPoints + score.candidateDmPoints;
    const ticketPoints =
      score.ticketMessages * TICKET_MESSAGE_POINT_VALUE;

    const headerLine = `${prefix} ${truncateDisplayName(
      score.username,
      28
    )} — **${formatNumber(score.points)} pts**`;

    const detailLine = [
      `🎫 \`${formatNumber(ticketPoints)}\``,
      `📣 \`${formatNumber(score.fcPosts)}\``,
      `👥 \`${formatNumber(candidatePoints)}\``,
      `📦 \`${score.candidateForwards}\``,
      `✉️ \`${score.candidateDms}\``,
      `💬 \`${score.messages}\``,
    ].join(" • ");

    return `${headerLine}\n${detailLine}`;
  });
};

const chunkEntries = (entries: string[]): string[] => {
  const chunks: string[] = [];
  let current = "";

  for (const entry of entries) {
    const sanitizedEntry = entry.trim();
    if (!sanitizedEntry) {
      continue;
    }

    if (current.length === 0) {
      current = sanitizedEntry;
      continue;
    }

    const candidate = `${current}\n\n${sanitizedEntry}`;
    if (candidate.length <= 1024) {
      current = candidate;
    } else {
      chunks.push(current);
      current = sanitizedEntry;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
};

const truncateDisplayName = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
};

export const formatNumber = (value: number): string => {
  if (Number.isNaN(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(1);
};

export const formatRecruiterLeaderboard = (
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

export const createRecruiterScoreComponents = (
  sessionId: string,
  totalPages: number,
  currentPage: number
): APIActionRowComponent<APIMessageActionRowComponent>[] => {
  if (totalPages <= 1) {
    return [];
  }

  const buttons: APIButtonComponentWithCustomId[] = [
    {
      type: ComponentType.Button,
      custom_id: `recruiter_score_first_${sessionId}`,
      emoji: { name: "⏮️" },
      style: ButtonStyle.Secondary,
      disabled: currentPage === 0,
    },
    {
      type: ComponentType.Button,
      custom_id: `recruiter_score_prev_${sessionId}`,
      emoji: { name: "◀️" },
      style: ButtonStyle.Primary,
      disabled: currentPage === 0,
    },
    {
      type: ComponentType.Button,
      custom_id: `recruiter_score_page_${sessionId}`,
      label: `${currentPage + 1} / ${totalPages}`,
      style: ButtonStyle.Secondary,
      disabled: true,
    },
    {
      type: ComponentType.Button,
      custom_id: `recruiter_score_next_${sessionId}`,
      emoji: { name: "▶️" },
      style: ButtonStyle.Primary,
      disabled: currentPage === totalPages - 1,
    },
    {
      type: ComponentType.Button,
      custom_id: `recruiter_score_last_${sessionId}`,
      emoji: { name: "⏭️" },
      style: ButtonStyle.Secondary,
      disabled: currentPage === totalPages - 1,
    },
  ];

  return [
    {
      type: ComponentType.ActionRow,
      components: buttons,
    },
  ];
};

export const getRecruiterLeaderboardComponents = (): APIActionRowComponent<APIMessageActionRowComponent>[] => [
  {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        custom_id: "recruiter_leaderboard_refresh",
        style: ButtonStyle.Primary,
        emoji: { name: "🔄" },
        label: "Refresh",
      },
    ],
  },
];
