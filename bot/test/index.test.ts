import { APIGatewayProxyEvent, EventBridgeEvent } from "aws-lambda";
import { handler, proxy, scheduled } from "../src";
import { authorizeRequest } from "../src/authorizer/authorizer";
import { eventClient } from "../src/clients/eventbridge-client";
import { handleCommand } from "../src/command-handlers";
import { handleComponent } from "../src/component-handlers";
import { submitModal } from "../src/modal-handlers/submit";
import {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { handleAutocomplete } from "../src/autocomplete-handlers";
import { createModal } from "../src/modal-handlers/create";
import { handleRecruiterScore } from "../src/command-handlers/recruiterScore";

jest.mock("../src/authorizer/authorizer");
jest.mock("../src/clients/eventbridge-client");
jest.mock("../src/command-handlers");
jest.mock("../src/component-handlers");
jest.mock("../src/modal-handlers/submit");
jest.mock("../src/modal-handlers/create");
jest.mock("../src/autocomplete-handlers");
jest.mock("../src/command-handlers/recruiterScore");

let mockApiEvent: APIGatewayProxyEvent;
let mockEvent: EventBridgeEvent<
  string,
  APIChatInputApplicationCommandInteraction
>;

afterEach(jest.resetAllMocks);

describe("proxy", () => {
  beforeEach(() => {
    jest.mocked(authorizeRequest).mockReturnValue(true);
  });

  test("should call authorizeRequest", async () => {
    mockApiEvent = createMockApiEvent(InteractionType.Ping, undefined, undefined);
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
    mockApiEvent = createMockApiEvent(InteractionType.Ping, "test", undefined);
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({ type: 1 }),
    });
  });

  test('should call handleAutocomplete when event is for autocomplete interaction', async () => {
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommandAutocomplete, "autocomplete", undefined);
    await proxy(mockApiEvent);
    expect(handleAutocomplete).toHaveBeenCalledWith(JSON.parse(mockApiEvent.body!));
  });

  test('should return 200 with expected response when event is for autocomplete interaction', async () => {
    const mockResponse = {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: { 
        choices: [
          { name: 'auto', value: 'complete' }
        ]
      }
    }
    jest.mocked(handleAutocomplete).mockResolvedValue(mockResponse);
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommandAutocomplete, 'autocomplete', undefined);
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify(mockResponse)
    });
  });

  test('should call createModal when application command requires modal', async () => {
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommand, 'apply', undefined);
    await proxy(mockApiEvent);
    expect(createModal).toHaveBeenCalledWith(JSON.parse(mockApiEvent.body!), 'apply');
  });

  test('should return modal when application command requires modal', async () => {
    jest.mocked(createModal).mockReturnValue({ type: InteractionResponseType.Modal } as APIInteractionResponse);
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommand, 'apply', undefined);
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({ type: InteractionResponseType.Modal })
    })
  });

  test('should call createModal when message component requires modal', async () => {
    mockApiEvent = createMockApiEvent(InteractionType.MessageComponent, undefined, 'apply');
    await proxy(mockApiEvent);
    expect(createModal).toHaveBeenCalledWith(JSON.parse(mockApiEvent.body!), 'apply');
  });

  test('should return modal when message component requires modal', async () => {
    jest.mocked(createModal).mockReturnValue({ type: InteractionResponseType.Modal } as APIInteractionResponse);
    mockApiEvent = createMockApiEvent(InteractionType.MessageComponent, undefined, 'apply');
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({ type: InteractionResponseType.Modal })
    });
  });

  test("should create event when application command that does not require modal", async () => {
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommand, 'test', undefined);
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

  test("should return 200 ephemeral response when application command that does not require modal", async () => {
    mockApiEvent = createMockApiEvent(InteractionType.ApplicationCommand, 'test', undefined);
    expect(await proxy(mockApiEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        type: 5,
        data: {
          flags: MessageFlags.Ephemeral,
        },
      }),
    });
  });
});

describe("handler", () => {
  test('should call handleComponent when event is for message component', async () => {
    mockEvent = createMockEvent(InteractionType.MessageComponent);
    await handler(mockEvent);
    expect(handleComponent).toHaveBeenCalledWith(mockEvent.detail);
  });

  test('should call submitModal when event is for modal submit', async () => {
    mockEvent = createMockEvent(InteractionType.ModalSubmit);
    await handler(mockEvent);
    expect(submitModal).toHaveBeenCalledWith(mockEvent.detail);
  });

  test('should call handleCommand when event is for application command', async () => {
    mockEvent = createMockEvent(InteractionType.ApplicationCommand);
    await handler(mockEvent);
    expect(handleCommand).toHaveBeenCalledWith(mockEvent);
  })
});

describe("scheduled", () => {
  test('should call handleRecruiterScore when detail type is Generate Recruiter Score', async () => {
    await scheduled({ 
      "detail-type": "Generate Recruiter Score", 
      detail: {
        guildId: "1234567890"
      }
    } as EventBridgeEvent<string, any>);
    expect(handleRecruiterScore).toHaveBeenCalledWith("1234567890");
  })
})

const createMockApiEvent = (type: InteractionType, name: string | undefined, custom_id: string | undefined) => {
  return {
    body: JSON.stringify({
      type,
      data: {
        name,
        custom_id
      },
    }),
  } as unknown as APIGatewayProxyEvent;
};

const createMockEvent = (type: InteractionType) => {
  return {
    detail: {
      type
    },
  } as unknown as EventBridgeEvent<
    string,
    APIChatInputApplicationCommandInteraction
  >;
};
