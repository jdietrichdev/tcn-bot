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
  APIApplicationCommandAutocompleteInteraction,
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
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
  let response: Record<string, any>;
  if (!authorizeRequest(event)) {
    console.log("Unauthorized");
    return { statusCode: 401, body: "Unauthorized" };
  }
  console.log(event.body);
  const body = JSON.parse(event.body!) as APIInteraction;
  if (body.type === InteractionType.Ping) {
    response = { type: 1 };
  } else if (body.type === InteractionType.ApplicationCommandAutocomplete) {
    response = await handleAutocomplete(
      body
    );
  } else if (
    body.type === InteractionType.ApplicationCommand &&
    commandTriggersModal(body.data.name)
  ) {
    console.log("Command modal triggered");
    response = createModal(body, body.data.name);
  } else if (
    body.type === InteractionType.MessageComponent &&
    buttonTriggersModal(body.data.custom_id)
  ) {
    console.log("Button modal triggered");
    response = createModal(body, body.data.custom_id);
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id.startsWith("unrostered_")
  ) {
    console.log("Unrostered pagination button clicked");
    const { handleUnrosteredPagination } = await import("./component-handlers/unrosteredButton");
    response = await handleUnrosteredPagination(body as APIMessageComponentInteraction, body.data.custom_id);
  } else if (
    body.type === InteractionType.MessageComponent &&
    (body.data.custom_id.startsWith("task_list_first_") ||
     body.data.custom_id.startsWith("task_list_prev_") ||
     body.data.custom_id.startsWith("task_list_next_") ||
     body.data.custom_id.startsWith("task_list_last_") ||
     body.data.custom_id.startsWith("task_list_page_") ||
     body.data.custom_id === "task_refresh_list" ||
     body.data.custom_id === "task_create_new" ||
     body.data.custom_id === "task_list_all")
  ) {
    console.log("Task list pagination/refresh/create button clicked");
    const { handleTaskListPagination } = await import("./component-handlers/taskListButton");
    const taskListResponse = await handleTaskListPagination(body as APIMessageComponentInteraction, body.data.custom_id);
    response = taskListResponse || { type: InteractionResponseType.DeferredMessageUpdate };
  } else if (
    body.type === InteractionType.MessageComponent &&
    (body.data.custom_id.startsWith("task_claim_") ||
     body.data.custom_id.startsWith("task_complete_") ||
     body.data.custom_id.startsWith("task_unclaim_") ||
     body.data.custom_id.startsWith("task_approve_") ||
     body.data.custom_id === "task_refresh_dashboard")
  ) {
    console.log("Task action button clicked");
    const { handleTaskButtonInteraction } = await import("./component-handlers/taskButtons");
    const taskResponse = await handleTaskButtonInteraction(body as APIMessageComponentInteraction);
    response = taskResponse || { type: InteractionResponseType.DeferredMessageUpdate };
  } else if (
    body.type === InteractionType.MessageComponent &&
    body.data.custom_id.startsWith("roster_show_")
  ) {
    console.log("Roster show pagination button clicked");
    const { handleRosterShowPagination } = await import("./component-handlers/rosterShowButton");
    response = await handleRosterShowPagination(body as APIMessageComponentInteraction);
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
      'task-overview'
    ];
    
    const publicTaskButtons = [
      'task_claim_',
      'task_complete_',
      'task_unclaim_',
      'task_approve_',
      'task_list_first_',
      'task_list_prev_',
      'task_list_next_',
      'task_list_last_',
      'task_list_page_',
      'task_refresh_list',
      'task_refresh_dashboard'
    ];
    
    const isPublicCommand = body.type === InteractionType.ApplicationCommand && 
                           publicCommands.includes((body as APIChatInputApplicationCommandInteraction).data.name);
    
    const isPublicButton = body.type === InteractionType.MessageComponent && 
                          publicTaskButtons.some(buttonPrefix => 
                            (body as APIMessageComponentInteraction).data.custom_id.startsWith(buttonPrefix) ||
                            (body as APIMessageComponentInteraction).data.custom_id === buttonPrefix
                          );
    
    if (body.type === InteractionType.MessageComponent) {
      const customId = (body as APIMessageComponentInteraction).data.custom_id;
      console.log(`Button interaction: ${customId}, isPublic: ${isPublicButton}`);
    }
    if (body.type === InteractionType.ApplicationCommand) {
      const commandName = (body as APIChatInputApplicationCommandInteraction).data.name;
      console.log(`Slash command: ${commandName}, isPublic: ${isPublicCommand}`);
    }
    
    response = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: (isPublicCommand || isPublicButton) ? {} : {
        flags: MessageFlags.Ephemeral,
      },
    } as APIInteractionResponse;
  }
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  } as APIGatewayProxyResult;
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
