import {
  APIChatInputApplicationCommandInteraction,
  APIGuildMember,
  APIMessage,
} from "discord-api-types/v10";
import { handleAnnounceRoster } from "../../src/command-handlers/announceRoster";
import { getConfig, ServerConfig } from "../../src/util/serverConfig";
import axios from "axios";
import { parse } from "csv-parse/sync";
import {
  getServerMembers,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { getClan } from "../../src/adapters/coc-api-adapter";

jest.mock("axios");
jest.mock("csv-parse/sync");
jest.mock("../../src/util/serverConfig");
jest.mock("../../src/adapters/discord-adapter");
jest.mock("../../src/adapters/coc-api-adapter");

const ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=914552917&single=true&output=csv";

beforeEach(() => {
  jest.mocked(getConfig).mockReturnValue({
    CLAN_ROLE: "clanRole",
    ANNOUNCEMENT_CHANNEL: "announcementChannel",
  } as ServerConfig);
  jest.mocked(axios.get).mockResolvedValue({ data: { rosterData: [] } });
  jest.mocked(parse).mockReturnValue(buildMockRosterData());
  jest
    .mocked(getServerMembers)
    .mockResolvedValue([
      { user: { id: "123456", username: "username" } } as APIGuildMember,
    ]);
  jest.mocked(getClan).mockResolvedValue({ name: "Clan Name" });
  jest.mocked(sendMessage).mockResolvedValue({ id: "messageId" } as APIMessage);
});

afterEach(jest.resetAllMocks);

test("should call getConfig with correct parameters", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(getConfig).toHaveBeenCalledWith("guildId");
});

test("should call get with correct parameters", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(axios.get).toHaveBeenCalledWith(ROSTER_URL);
});

test("should call parse with correct parameters", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(parse).toHaveBeenCalledWith(
    { rosterData: [] },
    { columns: true, skip_empty_lines: true }
  );
});

test("should call getServerMembers with correct parameters", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(getServerMembers).toHaveBeenCalledWith("guildId");
});

test("should call getClan with correct parameters for each clan in roster data", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(getClan).toHaveBeenNthCalledWith(1, "clanTag");
  expect(getClan).toHaveBeenNthCalledWith(2, "clanTag2");
});

test("should call sendMessage with initial message", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(sendMessage).toHaveBeenNthCalledWith(
    1,
    {
      content:
        "<@&clanRole> below is the roster for the coming week, please get to where you need to be!",
    },
    "announcementChannel"
  );
});

test("should send and update messages for each clan", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(sendMessage).toHaveBeenNthCalledWith(
    2,
    {
      content:
        "# [Clan Name](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag>)",
    },
    "announcementChannel"
  );
  expect(updateMessage).toHaveBeenNthCalledWith(
    1,
    "announcementChannel",
    "messageId",
    {
      content:
        "# [Clan Name](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag>)\n<@123456> | Account Name\n",
    }
  );
  expect(sendMessage).toHaveBeenNthCalledWith(
    3,
    {
      content:
        "# [Clan Name](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag2>)",
    },
    "announcementChannel"
  );
  expect(updateMessage).toHaveBeenNthCalledWith(
    2,
    "announcementChannel",
    "messageId",
    {
      content:
        "# [Clan Name](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag2>)\n<@otherUsername> | Other Account Name\n",
    }
  );
});

test("should call updateResponse with correct parameters when roster announcement successful", async () => {
  await handleAnnounceRoster(buildInteraction());
  expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
    content: "Roster has been announced",
  });
});

test("should call updateResponse with correct parameters when roster announcement fails", async () => {
  jest.mocked(getClan).mockRejectedValue(new Error("Failed"));
  await handleAnnounceRoster(buildInteraction());
  expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
    content:
      "There was a failure processing roster announcement, please try again",
  });
});

const buildInteraction = () => {
  return {
    guild_id: "guildId",
    application_id: "appId",
    token: "token",
  } as APIChatInputApplicationCommandInteraction;
};

const buildMockRosterData = () => {
  return [
    {
      Tag: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag",
    },
    {
      Tag: "#playerTag",
      Discord: "username",
      Account: "Account Name",
    },
    {
      Tag: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=clanTag2",
    },
    {
      Tag: "#otherPlayerTag",
      Discord: "otherUsername",
      Account: "Other Account Name",
    },
  ];
};
