import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { sendMessage, updateResponse } from "../../src/adapters/discord-adapter";
import { handleCwlAnnounceRoster } from "../../src/command-handlers/cwlAnnounceRoster";
import { findCwlSignupByName } from "../../src/util/cwlSignupStore";

jest.mock("../../src/adapters/discord-adapter", () => ({
  sendMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/util/cwlSignupStore", () => ({
  findCwlSignupByName: jest.fn(),
}));
jest.mock("../../src/util/townHallEmoji", () => ({
  ...jest.requireActual("../../src/util/townHallEmoji"),
  loadTownHallEmojiMap: jest.fn(() => ({
    "16": "123456789012345678",
  })),
}));

const interaction = {
  application_id: "application",
  token: "token",
  guild_id: "guild",
  data: {
    options: [
      { name: "signup-name", type: 3, value: "November CWL" },
      { name: "channel", type: 7, value: "target-channel" },
    ],
  },
} as unknown as APIChatInputApplicationCommandInteraction;

describe("CWL roster announcement command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts each clan as a purple embed without signup controls", async () => {
    jest.mocked(findCwlSignupByName).mockResolvedValue({
      pk: "guild",
      sk: "signup#november",
      signupName: "November CWL",
      clans: [
        {
          name: "MiniPoint",
          tag: "2CYP9C9QG",
          league: "Master League I",
          link: "https://example.com/minipoint",
          accounts: [
            {
              userId: "player",
              playerTag: "#PLAYER1",
              playerName: "Player One",
              clanName: "Current Clan",
              townHallLevel: 16,
            },
          ],
        },
        {
          name: "AlphaPoint",
          tag: "2CLL8UJR2",
          league: "Champion League I",
          link: "https://example.com/alphapoint",
          accounts: [],
        },
      ],
    });

    await handleCwlAnnounceRoster(interaction);

    expect(findCwlSignupByName).toHaveBeenCalledWith(
      "guild",
      "November CWL"
    );
    expect(sendMessage).toHaveBeenCalledTimes(2);
    for (const [message, channelId] of jest.mocked(sendMessage).mock.calls) {
      expect(channelId).toBe("target-channel");
      expect(message.components).toBeUndefined();
      expect(message.embeds).toHaveLength(1);
      expect(message.embeds?.[0]).toMatchObject({
        color: 0x551a8b,
      });
    }
    expect(jest.mocked(sendMessage).mock.calls[0][0].embeds?.[0].description)
      .toContain("<@player> | **Player One** | Current Clan");
    expect(updateResponse).toHaveBeenCalledWith("application", "token", {
      content:
        "Final CWL rosters for **November CWL** were posted in <#target-channel>.",
    });
  });

  it("rejects a signup with no configured clans", async () => {
    jest.mocked(findCwlSignupByName).mockResolvedValue({
      pk: "guild",
      sk: "signup#november",
      signupName: "November CWL",
      clans: [],
    });

    await expect(handleCwlAnnounceRoster(interaction)).rejects.toThrow(
      'No clans are configured for "November CWL".'
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
