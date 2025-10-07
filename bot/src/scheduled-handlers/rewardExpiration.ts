import { DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
import { updateMessage } from "../adapters/discord-adapter";
import { schedulerClient } from "../clients/scheduler-client";

export const handleRewardExpiration = async (
  eventDetail: Record<string, string>
) => {
  try {
    const { channelId, messageId } = eventDetail;
    await updateMessage(channelId, messageId, {
      content: "Your reward has expired, sorry!",
      components: [],
    });

    await schedulerClient.send(
      new DeleteScheduleCommand({
        Name: `reward-expiration-${channelId}-${messageId}`,
      })
    );
  } catch (err) {
    console.error(`Failed to handle reward expiration: ${err}`);
    throw err;
  }
};
