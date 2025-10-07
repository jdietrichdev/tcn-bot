import { APIModalSubmitInteraction } from "discord-api-types/v10";
import { submitApplyModal } from "./apply";
import { submitDenyAppModal } from "./denyApp";
import { submitLeadApplyModal } from "./leadApply";
import { submitCwlAccountSignupModal } from "./signupAccount";
import { submitCwlQuestionsModal } from "./cwlQuestions";
import { submitVoteNominationModal } from "./nominationVote";

export const submitModal = async (interaction: APIModalSubmitInteraction) => {
  const id = interaction.data.custom_id.split("_")[0];
  switch (id) {
    case "applicationModal":
      await submitApplyModal(interaction);
      break;
    case "leadApplicationModal":
      await submitLeadApplyModal(interaction);
      break;
    case "denyAppModal":
      await submitDenyAppModal(interaction);
      break;
    case "cwlSignupModal":
      await submitCwlAccountSignupModal(interaction);
      break;
    case "cwlQuestions":
      await submitCwlQuestionsModal(interaction);
      break;
    case "vouchModal":
    case "opposeModal":
    case "not_sureModal":
      await submitVoteNominationModal(interaction);
  }
};
