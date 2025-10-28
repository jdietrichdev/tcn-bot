import { DeleteScheduleCommand } from '@aws-sdk/client-scheduler';
import { updateMessage } from '../adapters/discord-adapter';
import { schedulerClient } from '../clients/scheduler-client';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../util/serverConfig';

export const handleRewardExpiration = async (
  eventDetail: Record<string, string>,
) => {
  try {
    const { channelId, messageId, guildId, eventId, winner, sponsor, prize } =
      eventDetail;
    const config = getConfig(guildId);
    await updateMessage(channelId, messageId, {
      content: 'Your reward has expired, sorry!',
      components: [],
    });

    await schedulerClient.send(
      new DeleteScheduleCommand({
        Name: `reward-expiration-${channelId}-${messageId}`,
      }),
    );

    const rewardData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: 'event-rewards',
          },
        }),
      )
    ).Item!;

    const reward = rewardData.rewards.find(
      (reward: Record<string, any>) => reward.eventId === eventId,
    );
    reward.status = 'Expired';

    await updateMessage(config.REWARD_TRACKING_CHANNEL, reward.message, {
      content: `Winner: ${winner}\nSponsor: ${sponsor}\nPrize: ${prize}\nStatus: Pending`,
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: rewardData,
      }),
    );
  } catch (err) {
    console.error(`Failed to handle reward expiration: ${err}`);
    throw err;
  }
};
