import { updateMessage } from "../adapters/discord-adapter";

export const handleRewardExpiration = async (
  eventDetail: Record<string, string>
) => {
  try {
    const { channelId, messageId } = eventDetail;
    await updateMessage(channelId, messageId, {
      content: "Your reward has expired, sorry!",
      components: [],
    });
  } catch (err) {
    console.error(`Failed to handle reward expiration: ${err}`);
    throw err;
  }
};
