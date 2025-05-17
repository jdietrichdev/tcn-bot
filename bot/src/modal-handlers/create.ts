import {
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { createApplyModal } from "./apply";
import { createDenyAppModal } from "./denyApp";
import { createLeadApplyModal } from "./leadApply";

export const createModal = (
  interaction: APIMessageComponentInteraction
) => {
  switch (interaction.data.custom_id) {
    case "apply":
      return createApplyModal();
    case "applyLead":
      return createLeadApplyModal();
    case "denyApp":
      return createDenyAppModal(interaction as APIMessageComponentInteraction);
    default:
      throw new Error("No handler defined for creating modal");
  }
};
