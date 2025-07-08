import {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { createApplyModal } from "./apply";
import { createDenyAppModal } from "./denyApp";
import { createLeadApplyModal } from "./leadApply";
import { createCwlAccountSignupModal } from "./signupAccount";

export const createModal = async (
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
      return await createCwlAccountSignupModal(
        interaction as APIMessageComponentInteraction
      );
    default:
      throw new Error("No handler defined for creating modal");
  }
};
