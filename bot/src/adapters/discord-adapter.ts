import axios from "axios";
import {
  APIGuildMember,
  APIUser,
  RESTAPIGuildCreatePartialChannel,
  RESTPostAPIChannelMessageResult,
  RESTPostAPIChannelMessagesThreadsJSONBody,
  RESTPostAPICurrentUserCreateDMChannelJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";

const BASE_URL = "https://discord.com/api/v10";

export const updateResponse = async (
  applicationId: string,
  interactionToken: string,
  response: RESTPostAPIWebhookWithTokenJSONBody
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    await axios.patch(url, response);
  } catch (err) {
    throw new Error(`Failed to update response: ${err}`);
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
    throw new Error(`Failed to update message: ${err}`);
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
    throw new Error(`Failed to delete response: ${err}`);
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
    throw new Error(`Failed to delete message: ${err}`);
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
    throw new Error(`Failed to send message to ${channelId}: ${err}`);
  }
};

export const createThread = async (
  thread: RESTPostAPIChannelMessagesThreadsJSONBody,
  channelId: string,
  messageId: string
) => {
  const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}/threads`;
  try {
    await axios.post(url, thread, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Failed to create thread for message ${messageId}: ${err}`);
  }
};

export const createChannel = async (
  channel: RESTAPIGuildCreatePartialChannel,
  guildId: string
) => {
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
    throw new Error(`Failed to create channel in ${guildId}: ${err}`);
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
    throw new Error(`Failed to move channel ${channelId}: ${err}`);
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
    throw new Error(`Failed to delete channel ${channelId}: ${err}`);
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
    throw new Error("Unable to create DM with user");
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
    throw new Error("Unable to fetch user data");
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
    throw new Error("Unable to fetch user data");
  }
};

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
    throw new Error("Unable to grant role to user");
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
    throw new Error("Unable to remove role from user");
  }
};
