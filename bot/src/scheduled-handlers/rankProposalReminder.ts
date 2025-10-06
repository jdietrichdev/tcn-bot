import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getConfig } from "../util/serverConfig";
import { APIEmbed } from "discord-api-types/v10";
import { sendMessage } from "../adapters/discord-adapter";

export const handleRankProposalReminder = async (guildId: string) => {
  try {
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

    const reminderEmbed: APIEmbed = {
      title: "Rank Proposal Reminder",
      description: `Please make sure you are checking <#${config.RANK_PROPOSAL_CHANNEL}> and voting on proposals!`,
      fields: proposals.proposals.map((proposal: Record<string, any>) => {
        let yes = 0,
          no = 0;
        proposal.votes.forEach((vote: Record<string, any>) => {
          if (vote.type === "VOUCH") {
            yes++;
          } else if (vote.type === "OPPOSE") {
            no++;
          }
        });
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
      config.RANK_PROPOSAL_CHANNEL
    );
  } catch (err) {
    console.log("Failed handling rank proposal reminders", err);
  }
};
