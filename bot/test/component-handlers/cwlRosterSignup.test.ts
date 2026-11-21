import {
  APIMessageComponentInteraction,
  ComponentType,
} from "discord-api-types/v10";
import {
  grantRole,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { getPlayer } from "../../src/adapters/coc-api-adapter";
import { getPlayerCwlHistoryStats } from "../../src/adapters/clashking-adapter";
import { createCwlTryoutTicket } from "../../src/util/cwlTryoutTicket";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import {
  handleCwlRosterAccountSelect,
  handleCwlRosterSignup,
} from "../../src/component-handlers/cwlRosterSignup";
import { CwlSignupRecord } from "../../src/util/cwlSignup";

jest.mock("../../src/adapters/discord-adapter", () => ({
  grantRole: jest.fn(),
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/adapters/coc-api-adapter", () => ({
  getPlayer: jest.fn(),
}));
jest.mock("../../src/adapters/clashking-adapter", () => ({
  getPlayerCwlHistoryStats: jest.fn(),
}));
jest.mock("../../src/util/cwlTryoutTicket", () => ({
  createCwlTryoutTicket: jest.fn(),
}));
jest.mock("../../src/util/serverConfig", () => ({
  getCwlClanRoleId: jest.fn((config, clan) =>
    config.CWL_CLAN_ROLES?.[clan.tag]
  ),
  getConfig: jest.fn(() => ({
    CWL_TRYOUT_CATEGORIES: { titan: "titan-category" },
    CWL_CLAN_ROLES: { "2CYP9C9QG": "cwl-role" },
  })),
}));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock("../../src/util/townHallEmoji", () => {
  return {
    getTownHallEmoji: (
      level: number | undefined,
      emojiIds: Record<string, string>
    ) => {
      if (level === undefined) {
        return { markup: "🏠", componentEmoji: { name: "🏠" } };
      }
      const name = `town_hall_${level}`;
      const id = emojiIds[String(level)];
      return {
        markup: `<:${name}:${id}>`,
        componentEmoji: { id, name },
      };
    },
    loadTownHallEmojiMap: jest.fn(() => ({
      "16": "123456789012345678",
    })),
  };
});

const createSignup = (): CwlSignupRecord => ({
  pk: "guild",
  sk: "signup#november",
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
});

const createInteraction = (
  customId = "cwl_roster_signup:november:2CYP9C9QG"
) =>
  ({
    application_id: "application",
    token: "interaction-token",
    guild_id: "guild",
    member: { user: { id: "discord-user" }, roles: [] },
    data: { custom_id: customId },
  }) as unknown as APIMessageComponentInteraction;

const playerProfile = (name: string) => ({
  name,
  townHallLevel: 16,
  clan: { name: "Current Clan" },
  heroes: [
    { name: "Barbarian King", level: 90 },
    { name: "Archer Queen", level: 90 },
    { name: "Battle Machine", level: 35 },
    { name: "Battle Copter", level: 35 },
  ],
});

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

  it("lets users choose one of their linked accounts", async () => {
    jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
      Items: [{ tag: "#PLAYER1" }, { tag: "#PLAYER2" }],
    } as never);
    jest
      .mocked(getPlayer)
      .mockResolvedValueOnce(playerProfile("Player One") as never)
      .mockResolvedValueOnce(playerProfile("Player Two") as never);

    await handleCwlRosterSignup(createInteraction());

    const response = jest.mocked(updateResponse).mock.calls[0][2];
    expect(response.content).toBe(
      "Select one linked account to add to this clan roster:"
    );
    expect(response.embeds?.[0]?.fields?.[0]?.name).toContain(
      "<:town_hall_16:123456789012345678> Player One"
    );
    expect(response.embeds?.[0]?.fields?.[0]?.value).toContain(
      "BK 90"
    );
    expect(JSON.stringify(response.embeds)).not.toContain("Battle Machine");
    expect(JSON.stringify(response.embeds)).not.toContain("Battle Copter");
    expect(JSON.stringify(response.embeds)).not.toContain("🦸");
    const actionRow = response.components?.[0];
    if (!actionRow || !("components" in actionRow)) {
      throw new Error("Expected an account selection menu.");
    }
    const selector = actionRow.components[0];
    if (selector.type !== ComponentType.StringSelect) {
      throw new Error("Expected a string selection component.");
    }
    expect(selector.custom_id).toBe(
      "cwl_roster_account:november:2CYP9C9QG"
    );
    expect(selector.options).toEqual([
      {
        label: "Player One (#PLAYER1)",
        value: "#PLAYER1",
        description: "Town Hall 16",
        emoji: { id: "123456789012345678", name: "town_hall_16" },
      },
      {
        label: "Player Two (#PLAYER2)",
        value: "#PLAYER2",
        description: "Town Hall 16",
        emoji: { id: "123456789012345678", name: "town_hall_16" },
      },
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
        Item: createSignup(),
      } as never)
      .mockResolvedValueOnce({} as never);
    jest.mocked(getPlayer).mockResolvedValueOnce(playerProfile("Player One") as never);

    await handleCwlRosterSignup(createInteraction());

    expect(jest.mocked(updateMessage)).toHaveBeenCalledTimes(1);
    const rosterMessage = jest.mocked(updateMessage).mock.calls[0][2];
    expect(rosterMessage.embeds?.[0]?.description).toContain(
      "<:town_hall_16:123456789012345678> <@discord-user> | **Player One** | Current Clan"
    );
    expect(rosterMessage.embeds?.[0]?.description).not.toContain("Barbarian King");
    expect(jest.mocked(updateMessage).mock.calls[0].slice(0, 2)).toEqual([
      "channel",
      "roster-message",
    ]);
    expect(jest.mocked(grantRole)).toHaveBeenCalledWith(
      "guild",
      "discord-user",
      "cwl-role"
    );
    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      {
        content: "Added Player One (#PLAYER1) to the **MiniPoint** roster.",
      }
    );
  });

  it("adds the account selected from the multiple-account picker", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER2" }],
      } as never)
      .mockResolvedValueOnce({
        Item: createSignup(),
      } as never)
      .mockResolvedValueOnce({} as never);
    jest.mocked(getPlayer).mockResolvedValueOnce(playerProfile("Player Two") as never);

    const interaction = {
      ...createInteraction("cwl_roster_account:november:2CYP9C9QG"),
      data: {
        custom_id: "cwl_roster_account:november:2CYP9C9QG",
        component_type: ComponentType.StringSelect,
        values: ["#PLAYER2"],
      },
    } as unknown as APIMessageComponentInteraction;
    await handleCwlRosterAccountSelect(interaction);

    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      {
        content: "Added Player Two (#PLAYER2) to the **MiniPoint** roster.",
      }
    );
  });

  it("creates a tryout ticket and holds a first-time Titan signup", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER1" }],
      } as never)
      .mockResolvedValueOnce({
        Items: [{ tag: "#PLAYER1" }],
      } as never)
      .mockResolvedValueOnce({
        Item: {
          ...createSignup(),
          clans: [
            {
              ...createSignup().clans[0],
              league: "Titan I CWL",
            },
          ],
        },
      } as never);
    jest.mocked(getPlayer).mockResolvedValueOnce(playerProfile("Player One") as never);
    jest.mocked(getPlayerCwlHistoryStats).mockResolvedValueOnce({
      season: "2026-10",
      league: "Champion League I",
      averageStars: 2.8,
      attackCount: 7,
    });
    jest.mocked(createCwlTryoutTicket).mockResolvedValueOnce({
      channelId: "tryout-ticket",
      created: true,
    });

    await handleCwlRosterSignup(createInteraction());

    expect(jest.mocked(createCwlTryoutTicket)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "discord-user",
        playerTag: "#PLAYER1",
        targetLeague: "Titan I CWL",
        previousLeague: "Champion League I",
        averageStars: 2.8,
        categoryId: "titan-category",
        reason: expect.stringContaining("first-time Titan"),
      })
    );
    expect(jest.mocked(updateMessage)).not.toHaveBeenCalled();
    expect(jest.mocked(updateResponse)).toHaveBeenLastCalledWith(
      "application",
      "interaction-token",
      {
        content:
          "Staff review is required: A ticket is required for a first-time Titan CWL signup, even when the 2.8-star promotion requirement is met.\nCreated a private tryout ticket: <#tryout-ticket>. You have not been added to the roster.",
      }
    );
  });
});
