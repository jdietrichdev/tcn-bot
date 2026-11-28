import { getConfig } from "../util/serverConfig";
import { approveApp } from "./approveApp";
import { messageRecruit } from "./messageRecruit";
import { closeRecruit } from "./closeRecruit";
import { closeTicket } from "./closeTicket";
import { deleteTicket } from "./deleteTicket";
import { reopenTicket } from "./reopenTicket";
import { grantRoles } from "./grantRoles";
import { removeRoles } from "./removeRoles";
import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { confirmDelete } from "./confirmDelete";
import { rejectDelete } from "./rejectDelete";
import { signupCwl } from "./signupCwl";
import { exportCwlQuestions } from "./exportCwlQuestions";
import { claimEvent } from "./claim";
// import { vouchNomination } from "./vouchNomination";
// import { opposeNomination } from "./opposeNomination";
// import { indifferentNomination } from "./indifferentNomination";
import { nominationResults } from "./nominationResults";
import { answerQuestion } from "./answerQuestion";
import { handleUnrosteredPagination } from "./unrosteredButton";
import { handleTaskButtonInteraction } from "./taskButtons";
import { handleTaskListPagination } from "./taskListButton";
import { handleSubsApproval } from "./subsApproval";
import { handleRecruiterScorePagination } from "./recruiterScoreButton";
import { handleRecruiterLeaderboardRefresh } from "./recruiterLeaderboard";
import { handleBasePostComponent } from "./basePost";
import {
  handleCwlRosterOptOut,
  handleCwlRosterOptOutSelect,
  handleCwlRosterRefresh,
  handleCwlRosterAccountSelect,
  handleCwlRosterSignup,
} from "./cwlRosterSignup";
import { handleCwlSignupDashboard } from "./cwlSignupDashboard";
import { notifyCwlTryoutStaff } from "./cwlTryoutReady";

type Handler = (interaction: APIMessageComponentInteraction, config?: any) => Promise<any>;

const handlers: Record<string, Handler> = {
  approveApp: (interaction, config) => approveApp(interaction, config),
  messageRecruit: (interaction) => messageRecruit(interaction),
  closeRecruit: (interaction) => closeRecruit(interaction),
  closeTicket: (interaction, config) => closeTicket(interaction, config),
  cwlTryoutReady: (interaction) => notifyCwlTryoutStaff(interaction),
  deleteTicket: (interaction, config) => deleteTicket(interaction, config),
  reopenTicket: (interaction, config) => reopenTicket(interaction, config),
  grantRoles: (interaction, config) => grantRoles(interaction, config),
  removeRoles: (interaction, config) => removeRoles(interaction, config),
  confirmDelete: (interaction) => confirmDelete(interaction),
  rejectDelete: (interaction) => rejectDelete(interaction),
  signupCwl: (interaction) => signupCwl(interaction),
  exportCwlQuestions: (interaction) => exportCwlQuestions(interaction),
  nominationResults: (interaction) => nominationResults(interaction),
  recruiter_leaderboard_refresh: (interaction) => handleRecruiterLeaderboardRefresh(interaction),
};

const prefixHandlers: Record<string, Handler> = {
  cwl_roster_signup: (interaction) => handleCwlRosterSignup(interaction),
  cwl_roster_account: (interaction) => handleCwlRosterAccountSelect(interaction),
  cwl_roster_refresh: (interaction) => handleCwlRosterRefresh(interaction),
  cwl_roster_optout_account: (interaction) =>
    handleCwlRosterOptOutSelect(interaction),
  cwl_roster_optout: (interaction) => handleCwlRosterOptOut(interaction),
  cwl_roster_dashboard: (interaction) =>
    handleCwlSignupDashboard(interaction),
  cwl_dashboard_: (interaction) => handleCwlSignupDashboard(interaction),
  base_post_: (interaction) => handleBasePostComponent(interaction),
  task_list: (interaction) => handleTaskListPagination(interaction, interaction.data.custom_id),
  task_: (interaction) => handleTaskButtonInteraction(interaction),
  claim: (interaction) => claimEvent(interaction),
  answer: (interaction) => answerQuestion(interaction),
  unrostered_: (interaction) => handleUnrosteredPagination(interaction, interaction.data.custom_id),
  recruiter_score_: (interaction) => handleRecruiterScorePagination(interaction, interaction.data.custom_id),
  approve_sub_: (interaction) => handleSubsApproval(interaction),
  deny_sub_: (interaction) => handleSubsApproval(interaction),
};

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
): Promise<any> => {
  const customId = interaction.data.custom_id;
  console.log(`[handleComponent] Received custom_id: ${customId}`);

  if (handlers[customId]) {
    const needsConfig = ["approveApp", "closeTicket", "deleteTicket", "reopenTicket", "grantRoles", "removeRoles"].includes(customId);
    const config = needsConfig ? getConfig(interaction.guild_id!) : undefined;
    return await handlers[customId](interaction, config);
  }

  for (const prefix in prefixHandlers) {
    if (customId.startsWith(prefix)) {
      return await prefixHandlers[prefix](interaction);
    }
  }

  console.log(`[handleComponent] No handler found for custom_id: ${customId}`);
};
