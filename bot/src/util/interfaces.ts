import { ProposalType, Rank, VoteType } from "./enums";

export interface NominationVote {
  type: VoteType;
  user: string;
  reason: string;
}

export interface Proposal {
  message: string;
  proposalTime: string;
  proposedBy: string;
  rank: Rank;
  type: ProposalType;
  reason?: string;
  userId: string;
  username: string;
  result?: string;
  votes: NominationVote[];
}

export interface QuestionResponse {
  userId: string;
  username: string;
  response: string;
}

export interface Question {
  id?: string;
  message?: string;
  question: string;
  optionOne: string;
  optionTwo: string;
  optionThree?: string;
  optionFour?: string;
  responses?: QuestionResponse[];
  closed?: boolean;
  answer?: string;
  thumbnailUrl?: string;
}
