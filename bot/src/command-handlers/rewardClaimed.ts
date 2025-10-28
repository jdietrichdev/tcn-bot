import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { getConfig } from '../util/serverConfig';
import { getCommandOptionData } from '../util/interaction-util';
import {
  deleteChannel,
  updateMessage,
  updateResponse,
} from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const handleRewardClaimed = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const commandData =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        'reward',
      ).value;

    const [eventId, winnerId, prize] = commandData.split('_');

    const rewardData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: interaction.guild_id,
            sk: 'event-rewards',
          },
        }),
      )
    ).Item!;

    const reward = rewardData.rewards.find(
      (reward: Record<string, any>) =>
        reward.eventId === eventId &&
        reward.winnerId === winnerId &&
        reward.prize === prize,
    );
    reward.status === 'Claimed';

    await updateMessage(config.REWARD_TRACKING_CHANNEL, reward.message, {
      content: `Winner: ${reward.winner}\nSponsor: ${reward.sponsor}\nPrize: ${reward.prize}\nStatus: Claimed`,
    });

    await deleteChannel(reward.channel);

    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Reward has been claimed and ticket channel has been deleted',
    });
  } catch (err) {
    console.log('Failure handling reward claiming', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        'Failed while processing claimed reward, contact admin if you continue to see issues',
    });
  }
};
