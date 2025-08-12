import axios from "axios";
import axiosRetry from "axios-retry";
import {
  APIGuildMember,
  APIGuildTextChannel,
  APIMessage,
  APIRole,
  APIUser,
  GuildTextChannelType,
  RESTAPIGuildCreatePartialChannel,
  RESTGetAPIChannelMessageReactionUsersResult,
  RESTPostAPIChannelMessageResult,
  RESTPostAPIChannelMessagesThreadsJSONBody,
  RESTPostAPIChannelMessagesThreadsResult,
  RESTPostAPICurrentUserCreateDMChannelJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
  RESTPutAPIChannelPermissionJSONBody,
} from "discord-api-types/v10";
import { DiscordError } from "../util/errors";

const BASE_URL = "https://discord.com/api/v10";

axiosRetry(axios, { retries: 2 });

export const updateResponse = async (
  applicationId: string,
  interactionToken: string,
  response: RESTPostAPIWebhookWithTokenJSONBody
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    await axios.patch(url, response);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to update response",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const updateMessage = async (
  channelId: string,
  messageId: string,
  message: RESTPostAPIWebhookWithTokenJSONBody
) => {
  const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}`;
  try {
    await axios.patch(url, message, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to update message",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const deleteResponse = async (
  applicationId: string,
  interactionToken: string
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    await axios.delete(url);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to delete response",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const deleteMessage = async (channelId: string, messageId: string) => {
  const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}`;
  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to delete message",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const sendMessage = async (
  message: RESTPostAPIWebhookWithTokenJSONBody,
  channelId: string
): Promise<RESTPostAPIChannelMessageResult> => {
  const url = `${BASE_URL}/channels/${channelId}/messages`;
  try {
    const response = await axios.post(url, message, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to send message",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const pinMessage = async (channelId: string, messageId: string) => {
  const url = `${BASE_URL}/channels/${channelId}/pins/${messageId}`;
  try {
    await axios.put(
      url,
      {},
      {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
        },
      }
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to pin message",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const createThread = async (
  thread: RESTPostAPIChannelMessagesThreadsJSONBody,
  channelId: string,
  messageId: string
): Promise<RESTPostAPIChannelMessagesThreadsResult> => {
  const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}/threads`;
  try {
    const response = await axios.post(url, thread, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to create thread",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const getChannelMessages = async (
  channelId: string,
  end?: Date
): Promise<APIMessage[]> => {
  let fetching = true;
  let url = "";
  let before = "";
  const compiledMessages: APIMessage[] = [];
  try {
    while (fetching) {
      url = `${BASE_URL}/channels/${channelId}/messages?limit=100${
        before ? `&before=${before}` : ""
      }`;
      console.log(url);
      const response = await axios.get(
        `${url}${before ? `&before=${before}` : ""}`,
        {
          headers: {
            Authorization: `Bot ${process.env.BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      const messages = response.data as APIMessage[];
      for (const message of messages) {
        if (end && new Date(message.timestamp) < end) {
          fetching = false;
          break;
        } else {
          compiledMessages.push(message);
        }
      }
      if (messages.length < 100) {
        fetching = false;
      } else {
        before = messages[messages.length - 1].id;
      }
    }
    return compiledMessages;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to compile channel messages",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const getMessageReaction = async (
  channelId: string,
  messageId: string,
  reaction: string
): Promise<RESTGetAPIChannelMessageReactionUsersResult> => {
  const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}/reactions/${reaction}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data as APIUser[];
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to fetch message reactions",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const createChannel = async (
  channel: RESTAPIGuildCreatePartialChannel,
  guildId: string
): Promise<APIGuildTextChannel<GuildTextChannelType>> => {
  const url = `${BASE_URL}/guilds/${guildId}/channels`;
  try {
    const response = await axios.post(url, channel, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to create channel",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const moveChannel = async (channelId: string, categoryId: string) => {
  const url = `${BASE_URL}/channels/${channelId}`;
  try {
    await axios.patch(
      url,
      { parent_id: categoryId },
      {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to move channel",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const updateChannelPermissions = async (
  channelId: string,
  id: string,
  permissions: RESTPutAPIChannelPermissionJSONBody
) => {
  const url = `${BASE_URL}/channels/${channelId}/permissions/${id}`;
  try {
    await axios.put(url, permissions, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        console.log("User/role no longer in server");
      } else {
        throw new DiscordError(
          "Failed to update permissions",
          err.response?.data.message,
          err.response?.status ?? 500
        );
      }
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const deleteChannel = async (channelId: string) => {
  const url = `${BASE_URL}/channels/${channelId}`;
  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to delete channel",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const createDM = async (
  recipient: RESTPostAPICurrentUserCreateDMChannelJSONBody
) => {
  const url = `${BASE_URL}/users/@me/channels`;
  try {
    const response = await axios.post(url, recipient, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to create DM",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const getUser = async (userId: string): Promise<APIUser> => {
  const url = `${BASE_URL}/users/${userId}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to fetch user",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const getServerUser = async (
  guildId: string,
  userId: string
): Promise<APIGuildMember> => {
  const url = `${BASE_URL}/guilds/${guildId}/members/${userId}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to fetch server user",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const getServerMembers = async (
  guildId: string
): Promise<APIGuildMember[]> => {
  const url = `${BASE_URL}/guilds/${guildId}/members?limit=1000`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to fetch server members",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const createRole = async (guildId: string, roleName: string): Promise<APIRole> => {
  const url = `${BASE_URL}/guilds/${guildId}/roles`;
  try {
    const response = await axios.post(url, {
      name: roleName,
      mentionable: true,
      color: Math.floor(Math.random() * 0xFFFFFF)
    },
    {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to fetch server members",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
}

export const grantRole = async (
  guildId: string,
  userId: string,
  roleId: string
) => {
  const url = `${BASE_URL}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  try {
    await axios.put(
      url,
      {},
      {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to grant role",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};

export const removeRole = async (
  guildId: string,
  userId: string,
  roleId: string
) => {
  const url = `${BASE_URL}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new DiscordError(
        "Failed to remove role",
        err.response?.data.message,
        err.response?.status ?? 500
      );
    } else {
      throw new Error(`Unexpected error: ${err}`);
    }
  }
};
