import { EventBridgeEvent } from "aws-lambda";
import { handleRecruiterScore } from "../command-handlers/recruiterScore";
import { handleRankProposalReminder } from "../command-handlers/rankProposalReminder";
import { handleRewardExpiration } from "./rewardExpiration";

export const handleScheduled = async (
  event: EventBridgeEvent<string, Record<string, string>>
) => {
  try {
    switch (event["detail-type"]) {
      case "Generate Recruiter Score":
        return await handleRecruiterScore(event.detail.guildId);
      case "Rank Proposal Reminder":
        return await handleRankProposalReminder(event.detail.guildId);
      case "Reward Expiration":
        return await handleRewardExpiration(event.detail);
    }
  } catch (err) {
    console.error(`Failed handling scheduled event: ${err}`);
    throw err;
  }
};
