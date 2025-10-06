import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getConfig } from "../util/serverConfig";
import {
  APIApplicationCommandInteraction,
  APIEmbed,
} from "discord-api-types/v10";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { tallyVotes } from "../util/nomination-util";

export const handleRankProposalReminder = async (
  input: APIApplicationCommandInteraction | string
) => {
  try {
    const guildId = typeof input === "string" ? input : input.guild_id!;
    const config = getConfig(guildId);
    const proposals = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: guildId,
            sk: "rank-proposals",
          },
        })
      )
    ).Item!;

    if (proposals.proposals.length !== 0) {
      const reminderEmbed: APIEmbed = {
        title: "Rank Proposal Reminder",
        description: `Please make sure you are checking <#${config.RANK_PROPOSAL_CHANNEL}> and voting on proposals!`,
        fields: proposals.proposals.map((proposal: Record<string, any>) => {
          const [yes, no] = tallyVotes(proposal.votes);
          return {
            name: `${proposal.rank} ${proposal.type} - ${proposal.username}`,
            value: `Yes: ${yes}, No: ${no}`,
          };
        }),
      };

      await sendMessage(
        {
          embeds: [reminderEmbed],
        },
        config.FAMILY_LEAD_CHANNEL
      );
    } else {
      await sendMessage(
        {
          content:
            "There are no active proposals at this time, if you feel there is someone worthy of promotion/demotion use the `/nominate` command to get the process started",
        },
        config.FAMILY_LEAD_CHANNEL
      );
    }
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content: `Proposals compiled and sent to <#${config.FAMILY_LEAD_CHANNEL}>`,
      });
    }
  } catch (err) {
    console.log("Failed handling rank proposal reminders", err);
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content:
          "There was a failure generating the rank proposal reminder, please try again or contact admins for assistance",
      });
    }
  }
};
