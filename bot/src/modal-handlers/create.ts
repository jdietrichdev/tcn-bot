import {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { createApplyModal } from "./apply";
import { createDenyAppModal } from "./denyApp";
import { createLeadApplyModal } from "./leadApply";
import { createCwlAccountSignupModal } from "./signupAccount";
import { createCwlQuestionsModal } from "./cwlQuestions";
import { createVoteNominationModal } from "./nominationVote";

export const createModal = (
  interaction:
    | APIMessageComponentInteraction
    | APIApplicationCommandInteraction,
  trigger: string
) => {
  switch (trigger) {
    case "apply":
      return createApplyModal();
    case "lead-apply":
    case "applyLead":
      return createLeadApplyModal(interaction);
    case "denyApp":
      return createDenyAppModal(interaction as APIMessageComponentInteraction);
    case "signupAccount":
      return createCwlAccountSignupModal(
        interaction as APIMessageComponentInteraction
      );
    case "cwlQuestions":
      return createCwlQuestionsModal(interaction as APIMessageComponentInteraction);
    case "vouch":
    case "oppose":
    case "indifferent":
      return createVoteNominationModal(interaction as APIMessageComponentInteraction);
    default:
      throw new Error("No handler defined for creating modal");
  }
};
