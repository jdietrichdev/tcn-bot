import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { NominationVote } from "./interfaces";
import { VoteType } from "./enums";

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

export const addVote = (
  interaction: APIMessageComponentInteraction,
  votes: NominationVote[],
  vote: VoteType
) => {
  const user = interaction.member!.user.username;
  const index = votes.findIndex((vote) => vote.user === user);

  if (index !== -1) {
    votes[index].type = vote;
  } else {
    votes.push({ type: vote, user });
  }
};
