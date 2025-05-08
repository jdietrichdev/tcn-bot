import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  EventBridgeEvent,
} from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  APIApplicationCommandAutocompleteInteraction,
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIMessageButtonInteractionData,
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
import { createModal, ModalType } from "./modal-handlers/create";

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
      body as APIApplicationCommandAutocompleteInteraction
    );
  } else if (
    body.type === InteractionType.ApplicationCommand &&
    body.data.name === "apply"
  ) {
    response = createModal(body, ModalType.APPLY);
  } else if (
    body.type === InteractionType.MessageComponent &&
    ((body.data as APIMessageButtonInteractionData).custom_id === "denyApp" 
    || (body.data as APIMessageButtonInteractionData).custom_id === 'apply')
  ) {
    response = createModal(body, body.data.custom_id === "denyApp" ? ModalType.DENY_APP : ModalType.APPLY);
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
    response = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: {
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
    await handleComponent(event.detail as APIMessageComponentInteraction);
  } else if (event.detail.type === InteractionType.ModalSubmit) {
    await submitModal(event.detail as APIModalSubmitInteraction);
  } else {
    await handleCommand(
      event as EventBridgeEvent<
        string,
        APIChatInputApplicationCommandInteraction
      >
    );
  }
};
