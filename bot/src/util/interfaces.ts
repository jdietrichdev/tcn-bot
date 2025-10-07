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
  votes: NominationVote[];
}
