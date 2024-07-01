import { APIGatewayProxyEvent } from "aws-lambda";
import { proxy } from "../src";
import { authorizeRequest } from "../src/authorizer/authorizer";
import { eventClient } from "../src/clients/eventbridge-client";

jest.mock("../src/authorizer/authorizer");
jest.mock("../src/clients/eventbridge-client");

let mockEvent: APIGatewayProxyEvent;

beforeEach(() => {
  mockEvent = createMockEvent(4, "test");
  jest.mocked(authorizeRequest).mockReturnValue(true);
});

test("proxy to call authorizeRequest", async () => {
  await proxy(mockEvent);
  expect(authorizeRequest).toHaveBeenCalledWith(mockEvent);
});

test("proxy should return 401 when request is invalid", async () => {
  jest.mocked(authorizeRequest).mockReturnValue(false);
  expect(await proxy(mockEvent)).toEqual({
    statusCode: 401,
    body: "Unauthorized",
  });
});

test("proxy should create event when request is valid", async () => {
  await proxy(mockEvent);
  expect(jest.mocked(eventClient.send)).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        Entries: [
          {
            Detail: mockEvent.body,
            DetailType: "Bot Event Received",
            Source: "tcn-bot-event",
            EventBusName: "tcn-bot-events",
          },
        ],
      },
    })
  );
});

test("proxy should return pong response when request type is 1", async () => {
  mockEvent = createMockEvent(1, "test");
  expect(await proxy(mockEvent)).toEqual({
    statusCode: 200,
    body: JSON.stringify({ type: 1 }),
  });
});

test("proxy should return 200 Loading response when request is valid", async () => {
  expect(await proxy(mockEvent)).toEqual({
    statusCode: 200,
    body: JSON.stringify({ type: 4, content: "Loading..." }),
  });
});

const createMockEvent = (type: number, name: string | undefined) => {
  return {
    body: {
      type,
      data: {
        name,
      },
    },
  } as unknown as APIGatewayProxyEvent;
};
