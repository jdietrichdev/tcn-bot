import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { getConfig } from '../util/serverConfig';
import {
  APIApplicationCommandInteraction,
  APIEmbed,
} from 'discord-api-types/v10';
import { sendMessage, updateResponse } from '../adapters/discord-adapter';
import { tallyVotes } from '../util/nomination-util';

export const handleRankProposalReminder = async (
  input: APIApplicationCommandInteraction | string,
) => {
  try {
    const guildId = typeof input === 'string' ? input : input.guild_id!;
    const config = getConfig(guildId);
    const proposals = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: 'rank-proposals',
          },
        }),
      )
    ).Item!;


if (proposals.proposals.length !== 0) {
  // Lead proposals
  const leadProposals = proposals.proposals.filter(
    (proposal: Record<string, any>) => proposal.rank === "Lead" && !proposal.result
  );
  if (leadProposals.length > 0) {
    const leadEmbed: APIEmbed = {
      title: "Lead Rank Proposal Reminder",
      description: `Please check <#${config.LEAD_PROPOSAL_CHANNEL}> and vote on lead proposals!`,
      fields: leadProposals.map((proposal: Record<string, any>) => {
        const [yes, no] = tallyVotes(proposal.votes);
        return {
          name: `${proposal.rank} ${proposal.type} - ${proposal.username}`,
          value: `Yes: ${yes}, No: ${no}`,
        };
      }),
    };
    await sendMessage({ embeds: [leadEmbed] }, config.ADMIN_CHANNEL);
  }

  // Elder proposals
  const elderProposals = proposals.proposals.filter(
    (proposal: Record<string, any>) => proposal.rank === "Elder" && !proposal.result
  );
  if (elderProposals.length > 0) {
    const elderEmbed: APIEmbed = {
      title: "Elder Rank Proposal Reminder",
      description: `Please check <#${config.ELDER_PROPOSAL_CHANNEL}> and vote on elder proposals!`,
      fields: elderProposals.map((proposal: Record<string, any>) => {
        const [yes, no] = tallyVotes(proposal.votes);
        return {
          name: `${proposal.rank} ${proposal.type} - ${proposal.username}`,
          value: `Yes: ${yes}, No: ${no}`,
        };
      }),
    };
    await sendMessage({ embeds: [elderEmbed] }, config.FAMILY_LEAD_CHANNEL);
  }
} else {
      await sendMessage(
        {
          content:
            'There are no active proposals at this time, if you feel there is someone worthy of promotion/demotion use the `/nominate` command to get the process started',
        },
        config.FAMILY_LEAD_CHANNEL,
      );
    }
    if (typeof input !== 'string') {
      await updateResponse(input.application_id, input.token, {
        content: `Proposals compiled and sent to <#${config.FAMILY_LEAD_CHANNEL}>`,
      });
    }
  } catch (err) {
    console.log('Failed handling rank proposal reminders', err);
    if (typeof input !== 'string') {
      await updateResponse(input.application_id, input.token, {
        content:
          'There was a failure generating the rank proposal reminder, please try again or contact admins for assistance',
      });
    }
  }
};
