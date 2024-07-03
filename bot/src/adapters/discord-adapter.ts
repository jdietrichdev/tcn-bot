import axios from "axios";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

const BASE_URL = "https://discord.com/api/v10";

export const updateMessage = async (
  applicationId: string,
  interactionToken: string,
  response: RESTPostAPIWebhookWithTokenJSONBody
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  console.log(url);
  try {
    await axios.patch(url, response);
  } catch (err) {
    throw new Error(`Request to Discord failed ${err}`);
  }
};
