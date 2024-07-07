import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  EventBridgeEvent,
} from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
} from "discord-api-types/payloads/v10";
import { handleHello } from "./command-handlers/handlers";
import { handleCommandNotFound } from "./command-handlers/not-found";
import { handleFailure } from "./command-handlers/failure";

export const proxy = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let response: Record<string, any>;
  if (!authorizeRequest(event)) {
    console.log("Unauthorized");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const body = JSON.parse(event.body!) as APIInteraction;
  if (body.type == 1) {
    response = { type: 1 };
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
      type: 4,
      data: { content: "Loading..." },
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  } as APIGatewayProxyResult;
};

export const handler = async (
  event: EventBridgeEvent<string, APIChatInputApplicationCommandInteraction>
) => {
  console.log(JSON.stringify(event));
  try {
    switch (event.detail.data!.name) {
      case "hello":
        return await handleHello(event.detail);
      default:
        return await handleCommandNotFound(event.detail);
    }
  } catch (err) {
    console.error(err);
    await handleFailure(event.detail);
    throw err;
  }
};
