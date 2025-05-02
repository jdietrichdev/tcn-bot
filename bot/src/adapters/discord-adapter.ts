import axios from "axios";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

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
