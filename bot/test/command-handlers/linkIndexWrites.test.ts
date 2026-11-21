import { APIChatInputApplicationCommandInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { handleLink } from "../../src/command-handlers/link";
import { submitLinkAccountModal } from "../../src/modal-handlers/linkAccount";
import { getModalTextInputValue } from "../../src/util/modalComponents";

jest.mock("../../src/adapters/coc-api-adapter", () => ({ verify: jest.fn() }));
jest.mock("../../src/adapters/discord-adapter", () => ({ updateResponse: jest.fn() }));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock("../../src/util/modalComponents", () => ({ getModalTextInputValue: jest.fn() }));

describe("indexed player links", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(dynamoDbClient.send)
      .mockResolvedValueOnce({ Items: [] } as never)
      .mockResolvedValueOnce({} as never);
  });

  it("indexes links created by the slash command without changing their original key", async () => {
    const interaction = {
      application_id: "app",
      token: "token",
      member: { user: { id: "123" } },
      data: { options: [{ name: "create", options: [
        { name: "tag", value: "#aBc" },
        { name: "token", value: "token" },
      ] }] },
    } as unknown as APIChatInputApplicationCommandInteraction;
    await handleLink(interaction);
    expect(jest.mocked(dynamoDbClient.send).mock.calls[1][0].input).toEqual(
      expect.objectContaining({ Item: expect.objectContaining({
        sk: "player#aBc",
        normalizedPlayerTag: "player#ABC",
      }) })
    );
  });

  it("indexes links created from the account modal", async () => {
    jest.mocked(getModalTextInputValue)
      .mockReturnValueOnce("#aBc")
      .mockReturnValueOnce("token");
    const interaction = {
      application_id: "app",
      token: "token",
      member: { user: { id: "123" } },
    } as unknown as APIModalSubmitInteraction;
    await submitLinkAccountModal(interaction);
    expect(jest.mocked(dynamoDbClient.send).mock.calls[1][0].input).toEqual(
      expect.objectContaining({ Item: expect.objectContaining({
        sk: "player#aBc",
        normalizedPlayerTag: "player#ABC",
      }) })
    );
  });
});
