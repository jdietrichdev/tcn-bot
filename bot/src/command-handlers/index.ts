import { EventBridgeEvent } from "aws-lambda";
import {
  APIChatInputApplicationCommandInteraction,
  InteractionType,
  APIInteraction,
} from "discord-api-types/v10";
import * as commands from "./handlers";
import { handleTest } from "./test";
import { handleClanAdd } from "./clanAdd";
import { handleClanShow } from "./clan";
import { handleClanAutocomplete } from "./clanAutocomplete";

export type CommandHandler = (
  interaction: APIChatInputApplicationCommandInteraction
) => Promise<void>;

export interface Command {
  name: string;
  description: string;
  handler: CommandHandler;
}

export const handleCommand = async (
  event: EventBridgeEvent<string, APIInteraction>
) => {
  if (event.detail.type === InteractionType.ApplicationCommandAutocomplete) {
    return await handleClanAutocomplete(event.detail);
  }

  if (event.detail.type !== InteractionType.ApplicationCommand) {
    return;
  }

  const interaction = event.detail as APIChatInputApplicationCommandInteraction;

  try {
    switch (interaction.data.name) {
      case "hello":
        return await commands.handleHello(interaction);
      case "player":
        return await commands.handlePlayer(interaction);
      case "event":
        return await commands.handleEvent(interaction);
      case "link":
        return await commands.handleLink(interaction);
      case "test":
        return await handleTest(interaction);
      case "upgrade":
        return await commands.handleUpgrade(interaction);
      case "ro":
        return await commands.handleRecruit(interaction);
      case "recruiter-score":
        return await commands.handleRecruiterScore(interaction);
      case "recruiter-leaderboard":
        return await commands.handleRecruiterLeaderboard(interaction);
      case "cwl-roster":
        return await commands.handleCwlRoster(interaction);
      case "initiate-cwl-signup":
        return await commands.handleInitiateCwlSignup(interaction);
      case "cwl-questions":
        return await commands.handleCwlQuestions(interaction);
      case "close-ticket":
        return await commands.closeTicket(interaction);
      case "delete-ticket":
        return await commands.deleteTicket(interaction);
      case "create-event":
        return await commands.handleCreateEvent(interaction);
      case "question-create":
        return await commands.handleQuestionCreate(interaction);
      case "question-close":
        return await commands.handleQuestionClose(interaction);
      case "question-answer":
        return await commands.handleQuestionAnswer(interaction);
      case "event-leaderboard":
        return await commands.handleEventLeaderboard(interaction);
      case "event-winner":
        return await commands.handleEventWinner(interaction);
      case "nominate":
        return await commands.handleNominate(interaction);
      case "nomination-result":
        return await commands.handleNominationResult(interaction);
      case "rank-proposal-reminder":
        return await commands.handleRankProposalReminder(interaction);
      case "announce-roster":
        return await commands.handleAnnounceRoster(interaction);
      case "schedule-event":
        return await commands.handleScheduleEvent(interaction);
      case "unrostered":
        return await commands.handleUnrosteredCommand(interaction);
      case "create-roster":
        return await commands.handleCreateRoster(interaction);
      case "roster-add":
        return await commands.handleRosterAdd(interaction);
      case "roster-show":
        return await commands.handleRosterShow(interaction);
      case "roster-remove":
        return await commands.handleRosterRemove(interaction);
      case "roster-delete":
        return await commands.handleRosterDelete(interaction);
      case "export-rosters":
        return await commands.handleExportRosters(interaction);
      case "cwl-response":
        return await commands.handleCwlResponseCommand(interaction);
      case "task-create":
        return await commands.handleTaskCreate(interaction);
      case "task-claim":
        return await commands.handleTaskClaim(interaction);
      case "task-complete":
        return await commands.handleTaskComplete(interaction);
      case "task-list":
        return await commands.handleTaskList(interaction);
      case "task-dashboard":
        return await commands.handleTaskDashboard(interaction);
      case "task-unclaim":
        return await commands.handleTaskUnclaim(interaction);
      case "task-approve":
        return await commands.handleTaskApprove(interaction);
      case "task-delete":
        return await commands.handleTaskDelete(interaction);
      case "task-notify":
        return await commands.handleTaskNotify(interaction);
      case "task-set-due-date":
        return await commands.handleTaskSetDueDate(interaction);
      case "task-assign":
        return await commands.handleTaskAssign(interaction);
      case "task-reminders":
        return await commands.handleTaskReminders(interaction);
      case "task-admin-unclaim":
        return await commands.handleTaskAdminUnclaim(interaction);
      case "task-overview":
        return await commands.handleTaskOverview(interaction);
      case "register-subs":
        return await commands.handleRegisterSubsCommand(interaction);
      case "clan":
        // @ts-ignore - options are not strictly typed on the base interaction
        switch (interaction.data.options[0].name) {
          case "show":
            return await handleClanShow(interaction);
          case "add":
            return await handleClanAdd(interaction);
        }
        break; // Add break to prevent fall-through
      default:
        console.log("Command not found, responding to command");
        return await commands.handleCommandNotFound(interaction);
    }
  } catch (err) {
    console.error(err);
    await commands.handleFailure(interaction);
  }
};
