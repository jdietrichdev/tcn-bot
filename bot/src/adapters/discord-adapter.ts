import axios from "axios";
import {
  RESTAPIGuildCreatePartialChannel,
  RESTPostAPICurrentUserCreateDMChannelJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";

const BASE_URL = "https://discord.com/api/v10";

export const updateMessage = async (
  applicationId: string,
  interactionToken: string,
  response: RESTPostAPIWebhookWithTokenJSONBody
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    await axios.patch(url, response);
  } catch (err) {
    throw new Error(`Failed to update message: ${err}`);
  }
};

export const deleteMessage = async (
  applicationId: string,
  interactionToken: string
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    await axios.delete(url);
  } catch (err) {
    throw new Error(`Failed to delete message: ${err}`);
  }
};

export const sendMessage = async (
  message: RESTPostAPIWebhookWithTokenJSONBody,
  channelId: string
) => {
  const url = `${BASE_URL}/channels/${channelId}/messages`;
  try {
    await axios.post(url, message, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Failed to send message to ${channelId}: ${err}`);
  }
};

export const createChannel = async (
  channel: RESTAPIGuildCreatePartialChannel,
  guildId: string
) => {
  const url = `${BASE_URL}/guilds/${guildId}/channels`;
  try {
    return await axios.post(url, channel, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Failed to create channel in ${guildId}: ${err}`);
  }
};

export const moveChannel = async (
  channelId: string,
  categoryId: string;
) => {
  const url = `${BASE_URL}/channels/${channelId}`;
  try {
    await axios.patch(url, { parent_id: categoryId }, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      }
    });
  } catch (err) {
    throw new Error(`Failed to movr channel ${channelId}: ${err}`);
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

export const getUser = async (userId: string) => {
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
