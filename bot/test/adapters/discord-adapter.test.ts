import * as adapter from "../../src/adapters/discord-adapter";
import axios from "axios";
import { DiscordError } from "../../src/util/errors";
import { RESTPostAPIGuildScheduledEventJSONBody } from "discord-api-types/v10";

jest.mock("axios");

const BASE_URL = "https://discord.com/api/v10";

beforeEach(() => {
  jest.mocked(axios.isAxiosError).mockReturnValue(true);

  process.env.BOT_TOKEN = "BOT_TOKEN";
});

afterEach(jest.resetAllMocks);

test("updateResponse should call patch with correct parameters", async () => {
  await adapter.updateResponse("appId", "token", { content: "test" });
  expect(axios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`,
    { content: "test" }
  );
});

test("updateResponse should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.patch)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.updateResponse("appId", "token", { content: "test" })
  ).rejects.toThrow(
    new DiscordError("Failed to update response", "Permissions", 403)
  );
});

test("updateResponseWithAttachment should call patch with correct parameters", async () => {
  const mockResponse = new FormData();
  mockResponse.append("content", "Content");
  mockResponse.append("files[0]", new Blob(), "file.csv");
  await adapter.updateResponseWithAttachment("appId", "token", mockResponse);
  expect(axios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`,
    mockResponse
  );
});

test("updateResponseWithAttachment should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.patch)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.updateResponseWithAttachment("appId", "token", new FormData())
  ).rejects.toThrow(
    new DiscordError("Failed to update response", "Permissions", 403)
  );
});

test("updateMessage should call patch with correct parameters", async () => {
  await adapter.updateMessage("channelId", "messageId", { content: "test" });
  expect(axios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages/messageId`,
    {
      content: "test",
    },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("updateMessage should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.patch)
    .mockRejectedValue(buildMockAxiosError("Message doesn't exist", 400));
  await expect(
    adapter.updateMessage("channelId", "messageId", { content: "test" })
  ).rejects.toThrow(
    new DiscordError("Failed to update message", "Message doesn't exist", 400)
  );
});

test("deleteResponse should call delete with correct parameters", async () => {
  await adapter.deleteResponse("appId", "token");
  expect(axios.delete).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`
  );
});

test("deleteResponse should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.delete)
    .mockRejectedValue(buildMockAxiosError("Message doesn't exist", 400));
  await expect(adapter.deleteResponse("appId", "token")).rejects.toThrow(
    new DiscordError("Failed to delete response", "Message doesn't exist", 400)
  );
});

test("deleteMessage should call delete with correct parameters", async () => {
  await adapter.deleteMessage("channelId", "messageId");
  expect(axios.delete).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages/messageId`,
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
      },
    }
  );
});

test("deleteMessage should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.delete)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(adapter.deleteMessage("channelId", "messageId")).rejects.toThrow(
    new DiscordError("Failed to delete message", "Permissions", 403)
  );
});

test("sendMessage should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "test" } });
  await adapter.sendMessage({ content: "test" }, "channelId");
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages`,
    { content: "test" },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("sendMessage should return message data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "test" } });
  const response = await adapter.sendMessage({ content: "test" }, "channelId");
  expect(response).toEqual({ id: "test" });
});

test("sendMessage should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.post)
    .mockRejectedValue(buildMockAxiosError("Sporadic Error", 500));
  await expect(
    adapter.sendMessage({ content: "test" }, "channelId")
  ).rejects.toThrow(
    new DiscordError("Failed to send message", "Sporadic Error", 500)
  );
});

test("sendMessageWithAttachment should call patch with correct parameters", async () => {
  const mockMessage = new FormData();
  mockMessage.append("content", "Content");
  mockMessage.append("files[0]", new Blob(), "file.csv");
  await adapter.sendMessageWithAttachment(mockMessage, "channelId");
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages`,
    mockMessage,
    { headers: { Authorization: "Bot BOT_TOKEN" } }
  );
});

test("sendMessageWithAttachment should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.post)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.sendMessageWithAttachment(new FormData(), "channelId")
  ).rejects.toThrow(
    new DiscordError("Failed to update response", "Permissions", 403)
  );
});

test("pinMessage should call put with correct parameters", async () => {
  await adapter.pinMessage("channelId", "messageId");
  expect(axios.put).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/pins/messageId`,
    {},
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
      },
    }
  );
});

test("pinMessage should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.put)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(adapter.pinMessage("channelId", "messageId")).rejects.toThrow(
    new DiscordError("Failed to pin message", "Permissions", 403)
  );
});

test("createThread should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "test" } });
  await adapter.createThread({ name: "test" }, "channelId", "messageId");
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages/messageId/threads`,
    { name: "test" },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("createThread should return thread data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "test" } });
  const response = await adapter.createThread(
    { name: "test" },
    "channelId",
    "messageId"
  );
  expect(response).toEqual({ id: "test" });
});

test("createThread should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.post)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.createThread({ name: "test" }, "channelId", "messageId")
  ).rejects.toThrow(
    new DiscordError("Failed to create thread", "Permissions", 403)
  );
});

// getChannelMessages needs testing added

test("getMessageReaction should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: [{ id: "12345" }] });
  await adapter.getMessageReaction("channelId", "messageId", "reaction");
  expect(axios.get).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/messages/messageId/reactions/reaction`,
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
      },
    }
  );
});

test("getMessageReaction should return reaction users", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: [{ id: "12345" }] });
  const response = await adapter.getMessageReaction(
    "channelId",
    "messageId",
    "reaction"
  );
  expect(response).toEqual([{ id: "12345" }]);
});

test("getMessageReaction should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.get)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.getMessageReaction("channelId", "messageId", "reaction")
  ).rejects.toThrow(
    new DiscordError("Failed to fetch message reactions", "Permissions", 403)
  );
});

test("createChannel should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "12345" } });
  await adapter.createChannel({ name: "channel" }, "guildId");
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/guilds/guildId/channels`,
    { name: "channel" },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("createChannel should return channel data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "12345" } });
  const response = await adapter.createChannel({ name: "channel" }, "guildId");
  expect(response).toEqual({ id: "12345" });
});

test("createChannel should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.post)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.createChannel({ name: "channel" }, "guildId")
  ).rejects.toThrow(
    new DiscordError("Failed to create channel", "Permissions", 403)
  );
});

test("updateChannel should call patch with correct parameters", async () => {
  await adapter.updateChannel({ name: "Updated channel name" }, "channelId");
  expect(axios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId`,
    {
      name: "Updated channel name",
    },
    {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
});

test("updateChannel should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.patch)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.updateChannel({ name: "Updated channel name " }, "channelId")
  ).rejects.toThrow(
    new DiscordError("Failed to update channel", "Permissions", 403)
  );
});

test("moveChannel should call patch with correct parameters", async () => {
  await adapter.moveChannel("channelId", "categoryId");
  expect(axios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId`,
    { parent_id: "categoryId" },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("moveChannel should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.patch)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(adapter.moveChannel("channelId", "categoryId")).rejects.toThrow(
    new DiscordError("Failed to move channel", "Permissions", 403)
  );
});

test("updateChannelPermissions should call put with correct parameters", async () => {
  await adapter.updateChannelPermissions("channelId", "id", { type: 1 });
  expect(axios.put).toHaveBeenCalledWith(
    `${BASE_URL}/channels/channelId/permissions/id`,
    { type: 1 },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("updateChannelPermissions should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.put)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.updateChannelPermissions("channelId", "id", { type: 1 })
  ).rejects.toThrow(
    new DiscordError("Failed to update permissions", "Permissions", 403)
  );
});

test("deleteChannel should call delete with correct parameters", async () => {
  await adapter.deleteChannel("channelId");
  expect(axios.delete).toHaveBeenCalledWith(`${BASE_URL}/channels/channelId`, {
    headers: {
      Authorization: "Bot BOT_TOKEN",
    },
  });
});

test("deleteChannel should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.delete)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(adapter.deleteChannel("channelId")).rejects.toThrow(
    new DiscordError("Failed to delete channel", "Permissions", 403)
  );
});

test("createDM should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "12345" } });
  await adapter.createDM({ recipient_id: "12345" });
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/users/@me/channels`,
    { recipient_id: "12345" },
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("createDM should return channel data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "12345" } });
  const response = await adapter.createDM({ recipient_id: "54321" });
  expect(response).toEqual({ id: "12345" });
});

test("createDM should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.post)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(adapter.createDM({ recipient_id: "12345" })).rejects.toThrow(
    new DiscordError("Failed to create DM", "Permissions", 403)
  );
});

test("getUser should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { id: "12345" } });
  await adapter.getUser("userId");
  expect(axios.get).toHaveBeenCalledWith(`${BASE_URL}/users/userId`, {
    headers: {
      Authorization: "Bot BOT_TOKEN",
    },
  });
});

test("getUser should return user data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { id: "12345" } });
  const response = await adapter.getUser("userId");
  expect(response).toEqual({ id: "12345" });
});

test("getUser should throw DiscordError when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(buildMockAxiosError("No user", 404));
  await expect(adapter.getUser("userId")).rejects.toThrow(
    new DiscordError("Failed to fetch user", "No user", 404)
  );
});

test("getServerUser should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { id: "12345" } });
  await adapter.getServerUser("guildId", "userId");
  expect(axios.get).toHaveBeenCalledWith(
    `${BASE_URL}/guilds/guildId/members/userId`,
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
      },
    }
  );
});

test("getServerUser should return user data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { id: "12345" } });
  const response = await adapter.getServerUser("guildId", "userId");
  expect(response).toEqual({ id: "12345" });
});

test("getServerUser should throw DiscordError when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(buildMockAxiosError("No user", 404));
  await expect(adapter.getServerUser("guildId", "userId")).rejects.toThrow(
    new DiscordError("Failed to fetch server user", "No user", 404)
  );
});

test("getServerMembers should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: {} });
  await adapter.getServerMembers("guildId");
  expect(axios.get).toHaveBeenCalledWith(`${BASE_URL}/guilds/guildId/members?limit=1000`, {
    headers: {
      Authorization: "Bot BOT_TOKEN"
    }
  });
});

test("getServerMembers should return server members", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: [{ user: { id: "12345" } }] });
  const response = await adapter.getServerMembers("guildId");
  expect(response).toEqual([{ user: { id: "12345" } }]);
});

test("getServerMembers should throw DiscordError when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(buildMockAxiosError("Invalid permissions", 403));
  await expect(adapter.getServerMembers("guildId")).rejects.toThrow(
    new DiscordError("Failed to fetch server members", "Invalid permissions", 403)
  );
});

test("createRole should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  await adapter.createRole("guildId", "role");
  expect(axios.post).toHaveBeenCalledWith(`${BASE_URL}/guilds/guildId/roles`,
    expect.objectContaining({
      name: "role",
      mentionable: true
    }),
    {
      headers: {
        Authorization: "Bot BOT_TOKEN"
      }
    }
  )
});

test("createRole should return role data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { id: "roleId", name: "role" }});
  const response = await adapter.createRole("guildId", "role");
  expect(response).toEqual({ id: "roleId", name: "role" });
});

test("createRole should throw DiscordError when request fails", async () => {
  jest.mocked(axios.post).mockRejectedValue(buildMockAxiosError("Invalid permissions", 403));
  await expect(adapter.createRole("guildId", "role")).rejects.toThrow(
    new DiscordError("Failed to create new role", "Invalid permissions", 403)
  );
});

test("deleteRole should call delete with correct parameters", async () => {
  await adapter.deleteRole("guildId", "roleId");
  expect(axios.delete).toHaveBeenCalledWith(`${BASE_URL}/guilds/guildId/roles/roleId`, {
    headers: {
      Authorization: "Bot BOT_TOKEN"
    }
  });
});

test("deleteRole should throw DiscordError when request fails", async () => {
  jest.mocked(axios.delete).mockRejectedValue(buildMockAxiosError("Invalid permissions", 403));
  await expect(adapter.deleteRole("guildId", "roleId")).rejects.toThrow(
    new DiscordError("Failed to delete role", "Invalid permissions", 403)
  );
})

test("grantRole should call put with correct parameters", async () => {
  await adapter.grantRole("guildId", "userId", "roleId");
  expect(axios.put).toHaveBeenCalledWith(
    `${BASE_URL}/guilds/guildId/members/userId/roles/roleId`,
    {},
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("grantRole should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.put)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.grantRole("guildId", "userId", "roleId")
  ).rejects.toThrow(
    new DiscordError("Failed to grant role", "Permissions", 403)
  );
});

test("removeRole should call put with correct parameters", async () => {
  await adapter.removeRole("guildId", "userId", "roleId");
  expect(axios.delete).toHaveBeenCalledWith(
    `${BASE_URL}/guilds/guildId/members/userId/roles/roleId`,
    {
      headers: {
        Authorization: "Bot BOT_TOKEN",
      },
    }
  );
});

test("removeRole should throw DiscordError when request fails", async () => {
  jest
    .mocked(axios.delete)
    .mockRejectedValue(buildMockAxiosError("Permissions", 403));
  await expect(
    adapter.removeRole("guildId", "userId", "roleId")
  ).rejects.toThrow(
    new DiscordError("Failed to remove role", "Permissions", 403)
  );
});

test("getAttachment should call get with the correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: {} });
  await adapter.getAttachment("url");
  expect(axios.get).toHaveBeenCalledWith("url", {
    responseType: "arraybuffer"
  });
});

test("getAttachment should return attachment data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: 'abcdef' });
  const response = await adapter.getAttachment("url");
  expect(response).toEqual("abcdef");
});

test("getAttachment should throw DiscordError when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(buildMockAxiosError("Not found", 404));
  await expect(adapter.getAttachment("url")).rejects.toThrow(
    new DiscordError("Failed to retrieve attachment data", "Not found", 404)
  );
});

test("createEvent should call post with correct parameters", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  await adapter.createEvent({ name: "event" } as RESTPostAPIGuildScheduledEventJSONBody, "guildId");
  expect(axios.post).toHaveBeenCalledWith(`${BASE_URL}/guilds/guildId/scheduled-events`, {
    name: "event"
  }, {
    headers: {
      Authorization: "Bot BOT_TOKEN",
      "Content-Type": "application/json"
    }
  })
});

test("createEvent should return event data", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: { name: "event" } });
  const response = await adapter.createEvent({ name: "event" } as RESTPostAPIGuildScheduledEventJSONBody, "guildId");
  expect(response).toEqual({ name: "event" });
});

test("createEvent should throw DiscordError when request fails", async () => {
  jest.mocked(axios.post).mockRejectedValue(buildMockAxiosError("Invalid permissions", 403));
  await expect(adapter.createEvent({ name: "event" } as RESTPostAPIGuildScheduledEventJSONBody, "guildId")).rejects.toThrow(
    new DiscordError("Failed to create event", "Invalid permissions", 403)
  );
});

const buildMockAxiosError = (message: string, status: number) => {
  return {
    message: "Failed",
    response: {
      status,
      data: {
        message,
      },
    },
  };
};
