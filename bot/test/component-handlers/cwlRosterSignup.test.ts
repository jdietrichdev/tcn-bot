import {
  APIMessageComponentInteraction,
  ComponentType,
} from "discord-api-types/v10";
import {
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import {
  handleCwlRosterAccountSelect,
  handleCwlRosterSignup,
} from "../../src/component-handlers/cwlRosterSignup";
import { CwlSignupRecord } from "../../src/util/cwlSignup";

jest.mock("../../src/adapters/discord-adapter", () => ({
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));

const signup: CwlSignupRecord = {
  pk: "guild",
  sk: "signup#November CWL",
  signupName: "November CWL",
  channelId: "channel",
  status: "open",
  clans: [
    {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG",
      messageId: "roster-message",
      accounts: [],
    },
  ],
};

const createInteraction = (
  customId = "cwl_roster_signup:2CYP9C9QG:November CWL"
) =>
  ({
    application_id: "application",
    token: "interaction-token",
    guild_id: "guild",
    member: { user: { id: "discord-user" }, roles: [] },
    data: { custom_id: customId },
  }) as unknown as APIMessageComponentInteraction;

describe("CWL roster signup button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("directs users without linked accounts to /link create", async () => {
    jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
      Items: [],
    } as never);

    await handleCwlRosterSignup(createInteraction());

    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      {
        content:
          "You don't have any linked accounts yet. Use `/link create` to link a Clash of Clans account, then click the clan's signup button again.",
      }
    );
    expect(jest.mocked(updateMessage)).not.toHaveBeenCalled();
  });

  it("lets users choose between multiple linked accounts", async () => {
    jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
      Items: [{ tag: "#PLAYER1" }, { tag: "#PLAYER2" }],
    } as never);

    await handleCwlRosterSignup(createInteraction());

    const response = jest.mocked(updateResponse).mock.calls[0][2];
    expect(response.content).toBe(
      "Choose an account for the **November CWL** signup:"
    );
    const actionRow = response.components?.[0];
    if (!actionRow || !("components" in actionRow)) {
      throw new Error("Expected an account selection menu.");
    }
    const selector = actionRow.components[0];
    if (selector.type !== ComponentType.StringSelect) {
      throw new Error("Expected a string selection component.");
    }
    expect(selector.custom_id).toBe(
      "cwl_roster_account:2CYP9C9QG:November CWL"
    );
    expect(selector.options).toEqual([
      { label: "#PLAYER1", value: "#PLAYER1" },
      { label: "#PLAYER2", value: "#PLAYER2" },
    ]);
  });

  it("adds a user's sole linked account and refreshes the clan roster", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER1" }],
      } as never)
      .mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER1" }],
      } as never)
      .mockResolvedValueOnce({
        Item: signup,
      } as never)
      .mockResolvedValueOnce({} as never);

    await handleCwlRosterSignup(createInteraction());

    expect(jest.mocked(updateMessage)).toHaveBeenCalledTimes(1);
    const rosterMessage = jest.mocked(updateMessage).mock.calls[0][2];
    expect(rosterMessage.embeds?.[0]?.description).toContain(
      "<@discord-user> | `#PLAYER1`"
    );
    expect(jest.mocked(updateMessage).mock.calls[0].slice(0, 2)).toEqual([
      "channel",
      "roster-message",
    ]);
    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      { content: "Added #PLAYER1 to the **MiniPoint** roster." }
    );
  });

  it("adds the account selected from the multiple-account picker", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER2" }],
      } as never)
      .mockResolvedValueOnce({
        Item: signup,
      } as never)
      .mockResolvedValueOnce({} as never);

    const interaction = {
      ...createInteraction("cwl_roster_account:2CYP9C9QG:November CWL"),
      data: {
        custom_id: "cwl_roster_account:2CYP9C9QG:November CWL",
        component_type: ComponentType.StringSelect,
        values: ["#PLAYER2"],
      },
    } as unknown as APIMessageComponentInteraction;
    await handleCwlRosterAccountSelect(interaction);

    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      { content: "Added #PLAYER2 to the **MiniPoint** roster." }
    );
  });
});
