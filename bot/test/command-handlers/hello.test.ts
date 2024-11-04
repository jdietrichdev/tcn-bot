import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { handleHello } from "../../src/command-handlers/hello";
import { updateMessage } from "../../src/adapters/discord-adapter";
import { getCommandOptionData } from "../../src/util/interaction-util";

jest.mock("../../src/util/interaction-util");
jest.mock("../../src/adapters/discord-adapter");

let mockInteraction: APIChatInputApplicationCommandInteraction;

beforeEach(() => {
  mockInteraction = {
    application_id: "appId",
    token: "token",
    data: {
      options: [
        {
          name: "user",
          value: "123",
          type: 6,
        },
      ],
    },
  } as unknown as APIChatInputApplicationCommandInteraction;

  jest.mocked(getCommandOptionData).mockImplementation(() => {
    return {
      name: "user",
      value: "123",
      type: 6,
    };
  });
});

afterEach(jest.resetAllMocks);

test("should get user data", async () => {
  await handleHello(mockInteraction);
  expect(getCommandOptionData).toHaveBeenCalledWith(mockInteraction, "user");
});

test("should update message", async () => {
  await handleHello(mockInteraction);
  expect(updateMessage).toHaveBeenCalledWith("appId", "token", {
    content: "Hello <@123>!",
  });
});

// test("should throw error when failure updating message", async () => {
//   jest.mocked(updateMessage).mockImplementation(() => {
//     throw new Error("Failed");
//   });
//   await expect(() => {
//     handleHello(mockInteraction);
//   }).rejects.toThrow(new Error("Failed"));
// });
