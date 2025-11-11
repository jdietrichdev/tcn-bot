export const MAIL_REACTION_EMOJI = "✉️";
export const CANDIDATE_FORWARD_POINT_VALUE = 1;
export const CANDIDATE_DM_POINT_VALUE = 1;
export const TICKET_MESSAGE_POINT_VALUE = 0.1;
export const LEADERBOARD_EMBED_COLOR = 0x5865f2;

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
  candidateForwards: number;
  candidateDms: number;
  candidateForwardPoints: number;
  candidateDmPoints: number;
  ticketMessages: number;
  fcPosts: number;
  points: number;
}
