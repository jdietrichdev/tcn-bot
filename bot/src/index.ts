import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";

export const proxy = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let response: Record<string, number | string>;
  if (!authorizeRequest(event)) {
    return { statusCode: 401, body: "Unauthorized" };
  }
  const body = JSON.parse(JSON.stringify(event.body!));
  console.log(body);
  console.log(event.path);
  console.log(event.httpMethod);
  if (body.type === 1) {
    response = { type: 1 };
  } else if (body.data.name) {
    await eventClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Detail: body,
            DetailType: "Bot Event Received",
            Source: "tcn-bot-event",
            EventBusName: "tcn-bot-events",
          },
        ],
      })
    );
    response = { type: 4, content: "Loading..." };
  } else {
    return { statusCode: 404, body: "Invalid request" };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  } as APIGatewayProxyResult;
};

export const handler = async () => {
  return "handled";
};
