import axios from "axios";
import { APIInteractionResponse } from "discord-api-types/v10";

const BASE_URL = "https://discord.com/api/v10";

export const updateMessage = async (
  applicationId: string,
  interactionToken: string,
  response: APIInteractionResponse
) => {
  const url = `${BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  console.log(url);
  try {
    await axios.patch(url, JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Request to Discord failed ${err}`);
  }
};
