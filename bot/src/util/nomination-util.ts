import { NominationVote } from "./interfaces";

export const tallyVotes = (votes: NominationVote[]) => {
  let yes = 0,
    no = 0;
  votes.forEach((vote: Record<string, any>) => {
    if (vote.type === "VOUCH") {
      yes++;
    } else if (vote.type === "OPPOSE") {
      no++;
    }
  });
  return [yes, no];
};
