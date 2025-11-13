import { EventBridgeEvent } from "aws-lambda";
import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import * as commands from "./handlers";
import { handleTest } from "./test";

export const handleCommand = async (
  event: EventBridgeEvent<string, APIChatInputApplicationCommandInteraction>
) => {
  try {
    switch (event.detail.data.name) {
      case "hello":
        return await commands.handleHello(event.detail);
      case "player":
        return await commands.handlePlayer(event.detail);
      case "event":
        return await commands.handleEvent(event.detail);
      case "link":
        return await commands.handleLink(event.detail);
      case "test":
        return await handleTest(event.detail);
      case "upgrade":
        return await commands.handleUpgrade(event.detail);
      case "ro":
        return await commands.handleRecruit(event.detail);
      case "recruiter-score":
        return await commands.handleRecruiterScore(event.detail);
      case "recruiter-leaderboard":
        return await commands.handleRecruiterLeaderboard(event.detail);
      case "cwl-roster":
        return await commands.handleCwlRoster(event.detail);
      case "initiate-cwl-signup":
        return await commands.handleInitiateCwlSignup(event.detail);
      case "cwl-questions":
        return await commands.handleCwlQuestions(event.detail);
      case "close-ticket":
        return await commands.closeTicket(event.detail);
      case "delete-ticket":
        return await commands.deleteTicket(event.detail);
      case "create-event":
        return await commands.handleCreateEvent(event.detail);
      case "question-create":
        return await commands.handleQuestionCreate(event.detail);
      case "question-close":
        return await commands.handleQuestionClose(event.detail);
      case "question-answer":
        return await commands.handleQuestionAnswer(event.detail);
      case "event-leaderboard":
        return await commands.handleEventLeaderboard(event.detail);
      case "event-winner":
        return await commands.handleEventWinner(event.detail);
      case "nominate":
        return await commands.handleNominate(event.detail);
      case "nomination-result":
        return await commands.handleNominationResult(event.detail);
      case "rank-proposal-reminder":
        return await commands.handleRankProposalReminder(event.detail);
      case "announce-roster":
        return await commands.handleAnnounceRoster(event.detail);
      case "schedule-event":
        return await commands.handleScheduleEvent(event.detail);
      case "unrostered":
        return await commands.handleUnrosteredCommand(event.detail);
      case "create-roster":
        return await commands.handleCreateRoster(event.detail);
      case "roster-add":
        return await commands.handleRosterAdd(event.detail);
      case "roster-show":
        return await commands.handleRosterShow(event.detail);
      case "roster-remove":
        return await commands.handleRosterRemove(event.detail);
      case "roster-delete":
        return await commands.handleRosterDelete(event.detail);
      case "export-rosters":
        return await commands.handleExportRosters(event.detail);
      case "cwl-response":
        return await commands.handleCwlResponseCommand(event.detail);
      case "task-create":
        return await commands.handleTaskCreate(event.detail);
      case "task-claim":
        return await commands.handleTaskClaim(event.detail);
      case "task-complete":
        return await commands.handleTaskComplete(event.detail);
      case "task-list":
        return await commands.handleTaskList(event.detail);
      case "task-dashboard":
        return await commands.handleTaskDashboard(event.detail);
      case "task-unclaim":
        return await commands.handleTaskUnclaim(event.detail);
      case "task-approve":
        return await commands.handleTaskApprove(event.detail);
      case "task-delete":
        return await commands.handleTaskDelete(event.detail);
      case "task-notify":
        return await commands.handleTaskNotify(event.detail);
      case "task-set-due-date":
        return await commands.handleTaskSetDueDate(event.detail);
      case "task-assign":
        return await commands.handleTaskAssign(event.detail);
      case "task-reminders":
        return await commands.handleTaskReminders(event.detail);
      case "task-admin-unclaim":
        return await commands.handleTaskAdminUnclaim(event.detail);
      case "task-overview":
        return await commands.handleTaskOverview(event.detail);
      case "register-subs":
        return await commands.handleRegisterSubsCommand(event.detail);
      default:
        console.log("Command not found, responding to command");
        return await commands.handleCommandNotFound(event.detail);
    }
  } catch (err) {
    console.error(err);
    await commands.handleFailure(event.detail);
  }
};
