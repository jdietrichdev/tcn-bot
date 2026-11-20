import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import {
  sendMessage,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { handleInitiateCwlSignup } from "../../src/command-handlers/initiateCwlSignup";
import {
  findCwlSignupByName,
  saveCwlSignup,
} from "../../src/util/cwlSignupStore";
import { CwlSignupRecord } from "../../src/util/cwlSignup";

jest.mock("../../src/adapters/discord-adapter", () => ({
  sendMessage: jest.fn(),
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/util/cwlSignupStore", () => ({
  findCwlSignupByName: jest.fn(),
  saveCwlSignup: jest.fn(),
}));
jest.mock("../../src/util/townHallEmoji", () => ({
  ...jest.requireActual("../../src/util/townHallEmoji"),
  loadTownHallEmojiMap: jest.fn(() => ({})),
}));

const interaction = {
  application_id: "application",
  token: "token",
  guild_id: "guild",
  data: {
    options: [
      { name: "name", type: 3, value: "November CWL" },
      { name: "channel", type: 7, value: "target-channel" },
    ],
  },
} as unknown as APIChatInputApplicationCommandInteraction;

const makeSignup = (): CwlSignupRecord => ({
  pk: "guild",
  sk: "signup#november",
  signupName: "November CWL",
  clans: [
    {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://example.com/minipoint",
      accounts: [],
    },
  ],
});

describe("CWL signup initiation command", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("posts signup rosters to the selected channel", async () => {
    const signup = makeSignup();
    jest.mocked(findCwlSignupByName).mockResolvedValue(signup);
    jest.mocked(sendMessage).mockResolvedValue({ id: "roster-message" } as never);
    jest.useFakeTimers();

    const result = handleInitiateCwlSignup(interaction);
    await jest.runAllTimersAsync();
    await result;

    expect(findCwlSignupByName).toHaveBeenCalledWith("guild", "November CWL");
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
      "target-channel"
    );
    expect(signup.channelId).toBe("target-channel");
    expect(signup.clans[0].messageId).toBe("roster-message");
    expect(updateResponse).toHaveBeenCalledWith("application", "token", {
      content:
        "CWL roster signups are posted in <#target-channel>. Created 1 new roster.",
    });
  });

  it("disables previous roster controls when moving a signup to another channel", async () => {
    const signup = makeSignup();
    signup.channelId = "old-channel";
    signup.clans[0].messageId = "old-message";
    jest.mocked(findCwlSignupByName).mockResolvedValue(signup);
    jest.mocked(sendMessage).mockResolvedValue({ id: "new-message" } as never);
    jest.useFakeTimers();

    const result = handleInitiateCwlSignup(interaction);
    await jest.runAllTimersAsync();
    await result;

    expect(updateMessage).toHaveBeenCalledWith(
      "old-channel",
      "old-message",
      {
        content: "This CWL signup has moved to <#target-channel>.",
        embeds: [],
        components: [],
      }
    );
    expect(sendMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "target-channel"
    );
    expect(signup.channelId).toBe("target-channel");
    expect(signup.clans[0].messageId).toBe("new-message");
  });
});
