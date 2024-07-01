import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { APIInteraction } from "discord-api-types/payloads/v10";

export const proxy = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let response: Record<string, number | string>;
  if (!authorizeRequest(event)) {
    console.log("Unauthorized");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const body = JSON.parse(event.body!) as APIInteraction;
  console.log(body);
  console.log(body.type);
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
  if (body.type == 1) {
    response = { type: 1 };
  } else {
    response = { type: 4, content: "Loading..." };
  }
  console.log(response);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  } as APIGatewayProxyResult;
};

export const handler = async () => {
  return "handled";
};
