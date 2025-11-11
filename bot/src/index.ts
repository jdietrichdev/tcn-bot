import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  EventBridgeEvent,
  S3Event,
} from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/payloads/v10";
import { handleCommand } from "./command-handlers";
import { handleAutocomplete } from "./autocomplete-handlers";
import { handleComponent } from "./component-handlers";
import { submitModal } from "./modal-handlers/submit";
import { createModal } from "./modal-handlers/create";
import {
  buttonTriggersModal,
  commandTriggersModal,
} from "./component-handlers/utils";
import { processCwlRoster } from "./processors/cwlRosterProcessor";
import { newAccountProcessor } from "./processors/newAccountProcessor";
import { handleScheduled } from "./scheduled-handlers";

export const proxy = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let response: APIInteractionResponse;
  if (!authorizeRequest(event)) {
    console.log("Unauthorized");
    return { statusCode: 401, body: "Unauthorized" };
  }
  console.log(event.body);
  const body = JSON.parse(event.body!) as APIInteraction;
  if (body.type === InteractionType.Ping) {
    response = { type: InteractionResponseType.Pong };
  } else if (body.type === InteractionType.ApplicationCommandAutocomplete) {
    response = (await handleAutocomplete(body)) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.ApplicationCommand &&
    commandTriggersModal(body.data.name)
  ) {
    console.log("Command modal triggered");
    response = createModal(body, body.data.name) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    buttonTriggersModal(body.data.custom_id)
  ) {
    console.log("Button modal triggered");
    response = createModal(body, body.data.custom_id) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id.startsWith("unrostered_")
  ) {
    console.log("Unrostered pagination button clicked");
    const { handleUnrosteredPagination } = await import("./component-handlers/unrosteredButton");
    response = (await handleUnrosteredPagination(body, body.data.custom_id)) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    (body.data.custom_id.startsWith("task_list_first_") ||
     body.data.custom_id.startsWith("task_list_prev_") ||
     body.data.custom_id.startsWith("task_list_next_") ||
     body.data.custom_id.startsWith("task_list_last_") ||
     body.data.custom_id.startsWith("task_list_page_"))
  ) {
    console.log("Task list pagination button clicked");
    const { handleTaskListPagination } = await import("./component-handlers/taskListButton");
    response = (await handleTaskListPagination(body, body.data.custom_id)) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id.startsWith("roster_show_")
  ) {
    console.log("Roster show pagination button clicked");
    const { handleRosterShowPagination } = await import("./component-handlers/rosterShowButton");
    response = (await handleRosterShowPagination(body)) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id.startsWith("recruiter_score_")
  ) {
    console.log("Recruiter score pagination button clicked");
    const { handleRecruiterScorePagination } = await import("./component-handlers/recruiterScoreButton");
    response = (await handleRecruiterScorePagination(body, body.data.custom_id)) as APIInteractionResponse;
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id === "recruiter_leaderboard_refresh"
  ) {
    console.log("Recruiter leaderboard refresh button clicked");
    const { handleRecruiterLeaderboardRefresh } = await import("./component-handlers/recruiterLeaderboard");
    response = (await handleRecruiterLeaderboardRefresh(body)) as APIInteractionResponse;
  } else {
    await eventClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Detail: event.body!,
            DetailType: "Bot Event Received",
            Source: "tcn-bot-event",
            EventBusName: "tcn-bot-events",
          },
        ],
      })
    );
    
    const publicCommands = [
      'unrostered', 
      'announceRoster', 
      'create-roster', 
      'roster-add', 
      'roster-show', 
      'roster-remove',
      'task-create',
      'task-claim',
      'task-complete',
      'task-approve',
      'task-list',
      'task-unclaim',
      'task-delete',
      'task-dashboard',
      'task-notify',
      'task-set-due-date',
      'task-assign',
      'task-reminders',
      'task-admin-unclaim',
      'task-overview',
      'recruiter-leaderboard'
    ];
    
    const publicTaskButtons = [
      'task_claim_',
      'task_complete_',
      'task_unclaim_',
      'task_approve_',
      'task_list_all',
      'task_list_my',
      'task_list_pending',
      'task_list_claimed',
      'task_list_completed',
      'task_list_approved',
      'task_list_available',
      'task_create_new',
      'task_refresh_list',
      'task_refresh_dashboard',
      'recruiter_score_',
      'recruiter_leaderboard_refresh'
    ];
    
    const commandName =
      body.type === InteractionType.ApplicationCommand ? body.data.name : undefined;
    const customId =
      body.type === InteractionType.MessageComponent ? body.data.custom_id : undefined;

    const isPublicCommand = Boolean(
      commandName && publicCommands.includes(commandName)
    );

    const isPublicButton = Boolean(
      customId && publicTaskButtons.some((buttonPrefix) => customId.startsWith(buttonPrefix))
    );

    if (customId) {
      console.log(`Button interaction: ${customId}, isPublic: ${isPublicButton}`);
    }
    if (commandName) {
      console.log(`Slash command: ${commandName}, isPublic: ${isPublicCommand}`);
    }

    response = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: isPublicCommand || isPublicButton ? {} : {
        flags: MessageFlags.Ephemeral,
      },
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};

export const handler = async (
  event: EventBridgeEvent<string, APIInteraction>
) => {
  console.log(JSON.stringify(event));
  if (event.detail.type === InteractionType.MessageComponent) {
    await handleComponent(event.detail);
  } else if (event.detail.type === InteractionType.ModalSubmit) {
    await submitModal(event.detail);
  } else {
    await handleCommand(
      event as EventBridgeEvent<
        string,
        APIChatInputApplicationCommandInteraction
      >
    );
  }
};

export const scheduled = async (
  event: EventBridgeEvent<string, Record<string, string>>
) => {
  console.log(JSON.stringify(event));
  await handleScheduled(event);
};

export const processor = async (event: S3Event | Record<string, string>[]) => {
  console.log(JSON.stringify(event));
  if ((event as S3Event).Records) {
    await processCwlRoster(event as S3Event);
  } else {
    await newAccountProcessor((event as Record<string, string>[])[0]);
  }
};
