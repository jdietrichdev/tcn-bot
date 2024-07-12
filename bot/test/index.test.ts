import { APIGatewayProxyEvent, EventBridgeEvent } from "aws-lambda";
import { handler, proxy } from "../src";
import { authorizeRequest } from "../src/authorizer/authorizer";
import { eventClient } from "../src/clients/eventbridge-client";
import { handleHello } from "../src/command-handlers/handlers";
import {
  APIChatInputApplicationCommandInteraction,
  MessageFlags,
} from "discord-api-types/v10";

jest.mock("../src/authorizer/authorizer");
jest.mock("../src/clients/eventbridge-client");
jest.mock("../src/command-handlers/handlers");

let mockApiEvent: APIGatewayProxyEvent;
let mockEvent: EventBridgeEvent<
  string,
  APIChatInputApplicationCommandInteraction
>;

afterEach(jest.resetAllMocks);

describe("proxy", () => {
  beforeEach(() => {
    mockApiEvent = createMockApiEvent(4, "test");
    jest.mocked(authorizeRequest).mockReturnValue(true);
  });

  test("to call authorizeRequest", async () => {
    await proxy(mockApiEvent);
    expect(authorizeRequest).toHaveBeenCalledWith(mockApiEvent);
  });

  test("should return 401 when request is invalid", async () => {
    jest.mocked(authorizeRequest).mockReturnValue(false);
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 401,
      body: "Unauthorized",
    });
  });

  test("should return pong response when request type is 1", async () => {
    mockApiEvent = createMockApiEvent(1, "test");
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({ type: 1 }),
    });
  });

  test("should create event when request is valid and type is not 1", async () => {
    await proxy(mockApiEvent);
    expect(jest.mocked(eventClient.send)).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Entries: [
            {
              Detail: mockApiEvent.body,
              DetailType: "Bot Event Received",
              Source: "tcn-bot-event",
              EventBusName: "tcn-bot-events",
            },
          ],
        },
      })
    );
  });

  test("should return 200 Loading response when request is valid and type is not 1", async () => {
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        type: 4,
        data: { content: "Loading...", flags: MessageFlags.Loading },
      }),
    });
  });
});

describe("handler", () => {
  test("should call handleHello when event name is hello", async () => {
    mockEvent = createMockEvent("hello");
    handler(mockEvent);
    expect(handleHello).toHaveBeenCalledWith(mockEvent.detail);
  });
});

const createMockApiEvent = (type: number, name: string | undefined) => {
  return {
    body: JSON.stringify({
      type,
      data: {
        name,
      },
    }),
  } as unknown as APIGatewayProxyEvent;
};

const createMockEvent = (name: string) => {
  return {
    detail: {
      data: {
        name,
      },
    },
  } as unknown as EventBridgeEvent<
    string,
    APIChatInputApplicationCommandInteraction
  >;
};
