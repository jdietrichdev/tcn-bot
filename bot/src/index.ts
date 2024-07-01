import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authorizeRequest } from "./authorizer/authorizer";
import { eventClient } from "./clients/eventbridge-client";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";

export const proxy = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let response: Record<string, number | string>;
  if (!authorizeRequest(event)) {
    console.log("Unauthorized");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const body = JSON.parse(JSON.stringify(event.body));
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
  console.log(body["type"]);
  if (body["type"] == 1) {
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
