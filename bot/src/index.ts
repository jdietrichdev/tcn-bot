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
    
    const publicCommands = ['unrostered', 'announceRoster', 'create-roster', 'roster-add', 'roster-show', 'roster-remove'];
    const isPublicCommand = body.type === InteractionType.ApplicationCommand && 
                           publicCommands.includes((body as APIChatInputApplicationCommandInteraction).data.name);
    
    response = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: isPublicCommand ? {} : {
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
