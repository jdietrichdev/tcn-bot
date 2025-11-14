import {
  APIActionRowComponent,
  APIEmbed,
  APIMessageActionRowComponent,
  APIMessageComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";

export const SCORE_PAGE_SIZE = 10;

export interface RecruiterScoreRow {
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

export interface ScoreTotals {
  ticketsClosed: number;
  messages: number;
  fcPostsWeek: number;
  ticketMessages: number;
  fcPosts: number;
  points: number;
  candidateForwards: number;
  candidateDms: number;
  candidateForwardPoints: number;
  candidateDmPoints: number;
}

export interface RecruiterScoreDisplayContext {
  recruitmentOppChannelId: string;
  clanPostsChannelId: string;
  generatedAt: string;
}

export const buildRecruiterScorePageEmbed = (
  scores: RecruiterScoreRow[],
  totals: ScoreTotals,
  context: RecruiterScoreDisplayContext,
  page: number,
  totalPages: number,
  pageSize: number
): APIEmbed => {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageScores = scores.slice(start, end);

  const fields = pageScores.map((score, index) => {
    const rank = start + index + 1;
    return {
      name: `${rank}. ${score.username}`,
      value: `> **${score.points}** points (${score.candidateForwards} fwd, ${score.candidateDms} dm, ${score.ticketMessages} tix, ${score.fcPosts} fc)`,
      inline: false,
    };
  });

  return {
    title: "Recruiter Weekly Scoreboard",
    description: `Scores based on activity in the last 7 days.`,
    fields: fields.length > 0 ? fields : [{ name: "No scores found", value: "There are no scores to display for this period." }],
    color: 0x0099ff,
    footer: {
      text: `Page ${page + 1} of ${totalPages} | Generated at ${new Date(
        context.generatedAt
      ).toUTCString()}`,
    },
  };
};

export const buildRecruiterTotalsEmbed = (
  totals: ScoreTotals,
  context: RecruiterScoreDisplayContext,
  page: number,
  totalPages: number
): APIEmbed => {
  return {
    title: "Recruiter Weekly Scoreboard - Totals",
    description: `Total activity across all recruiters in the last 7 days.`,
    fields: [
      { name: "Total Points", value: `> **${totals.points}**`, inline: true },
      { name: "Tickets Closed", value: `> ${totals.ticketsClosed}`, inline: true },
      { name: "FC Posts (Week)", value: `> ${totals.fcPostsWeek}`, inline: true },
      { name: "Candidate Forwards", value: `> ${totals.candidateForwards}`, inline: true },
      { name: "Candidate DMs", value: `> ${totals.candidateDms}`, inline: true },
      { name: "Ticket Messages (DB)", value: `> ${totals.ticketMessages}`, inline: true },
      { name: "FC Posts (DB)", value: `> ${totals.fcPosts}`, inline: true },
    ],
    color: 0x0099ff,
    footer: {
      text: `Page ${page + 1} of ${totalPages} | Generated at ${new Date(
        context.generatedAt
      ).toUTCString()}`,
    },
  };
};

export const createRecruiterScoreComponents = (
  sessionId: string,
  totalPages: number,
  currentPage: number
): APIActionRowComponent<APIMessageActionRowComponent>[] => {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          custom_id: `recruiter_score_first_${sessionId}`,
          label: "First",
          disabled: currentPage === 0,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          custom_id: `recruiter_score_prev_${sessionId}`,
          label: "Previous",
          disabled: currentPage === 0,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          custom_id: `recruiter_score_next_${sessionId}`,
          label: "Next",
          disabled: currentPage >= totalPages - 1,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          custom_id: `recruiter_score_last_${sessionId}`,
          label: "Last",
          disabled: currentPage >= totalPages - 1,
        },
      ],
    },
  ];
};

export const createRecruiterLeaderboardComponents = (): APIActionRowComponent<APIMessageActionRowComponent>[] => {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          custom_id: "recruiter_leaderboard_refresh",
          label: "Refresh",
          emoji: { name: "🔄" },
        },
      ],
    },
  ];
};

export const buildRecruiterLeaderboardEmbed = (
  scores: RecruiterScoreRow[]
): APIEmbed => {
  const topTen = scores.slice(0, 10);

  const fields = topTen.map((score, index) => {
    const rank = index + 1;
    const medal =
      rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
    return {
      name: `${medal} ${score.username}`,
      value: `> **${score.points}** points`,
      inline: false,
    };
  });

  return {
    title: "🏆 Recruiter Leaderboard",
    description: "Top 10 recruiters based on the last 7 days of activity.",
    fields: fields.length > 0 ? fields : [{ name: "No activity found", value: "The leaderboard is empty." }],
    color: 0x0099ff,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Leaderboard refreshes periodically",
    },
  };
};