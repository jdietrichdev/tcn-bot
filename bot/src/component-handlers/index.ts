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

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
): Promise<any> => {
  const customId = interaction.data.custom_id;
  console.log(`[handleComponent] Received custom_id: ${customId}`);
  
  // Route task board navigation and pagination first so they don't fall through to other handlers.
  if (
    customId === "task_list_all" ||
    customId === "task_list_my" ||
    customId === "task_list_completed"
  ) {
    console.log("[handleComponent] Routing to handleTaskButtonInteraction for task list navigation button");
    return await handleTaskButtonInteraction(interaction);
  }

  if (
    customId.startsWith("task_list_first_") ||
    customId.startsWith("task_list_prev_") ||
    customId.startsWith("task_list_next_") ||
    customId.startsWith("task_list_last_") ||
    customId.startsWith("task_list_page_") ||
    customId === "task_refresh_list" ||
    customId === "task_create_new"
  ) {
    console.log("[handleComponent] Routing to handleTaskListPagination for task list pagination/refresh");
    return await handleTaskListPagination(interaction, customId);
  } else if (customId.startsWith("task_")) {
    console.log("[handleComponent] Routing to handleTaskButtonInteraction for task_* button");
    return await handleTaskButtonInteraction(interaction);
  } else if (customId === "approveApp") {
    console.log(`[handleComponent] Handling approveApp for message: ${interaction.message.id}`);
    await approveApp(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "messageRecruit") {
    await messageRecruit(interaction);
  } else if (customId === "closeRecruit") {
    await closeRecruit(interaction);
  } else if (customId === "closeTicket") {
    await closeTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "deleteTicket") {
    await deleteTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "reopenTicket") {
    await reopenTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "grantRoles") {
    await grantRoles(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "removeRoles") {
    await removeRoles(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "confirmDelete") {
    await confirmDelete(interaction);
  } else if (customId === "rejectDelete") {
    await rejectDelete(interaction);
  } else if (customId === "signupCwl") {
    await signupCwl(interaction);
  } else if (customId === "exportCwlQuestions") {
    await exportCwlQuestions(interaction);
  } else if (customId.startsWith("claim")) {
    await claimEvent(interaction);
  } else if (customId === "nominationResults") {
    await nominationResults(interaction);
  } else if (customId.startsWith("answer")) {
    await answerQuestion(interaction);
  } else if (customId.startsWith("task_")) {
    if (
      customId.startsWith("task_list_first_") ||
      customId.startsWith("task_list_prev_") ||
      customId.startsWith("task_list_next_") ||
      customId.startsWith("task_list_last_") ||
      customId.startsWith("task_list_page_")
    ) {
      return await handleTaskListPagination(interaction, customId);
    }
    await handleTaskButtonInteraction(interaction);
  } else if (customId.startsWith("unrostered_")) {
    return await handleUnrosteredPagination(interaction, customId);
  } else if (customId.startsWith("recruiter_score_")) {
    await handleRecruiterScorePagination(interaction, customId);
  } else if (customId === "recruiter_leaderboard_refresh") {
    await handleRecruiterLeaderboardRefresh(interaction);
  } else if (customId.startsWith("approve_sub_") || customId.startsWith("deny_sub_")) {
    console.log(`[handleComponent] Routing to handleSubsApproval for: ${customId}`);
    await handleSubsApproval(interaction);
  } else {
    console.log(`[handleComponent] No handler found for custom_id: ${customId}`);
  }
};
