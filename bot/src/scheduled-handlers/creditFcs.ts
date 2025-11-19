import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getChannelMessages } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { getConfig } from '../util/serverConfig';

const FC_REGEX = /^RR\s*\n(Base \d+: .* star\s*\n?)+/im;


export const handleCreditFcs = async (event: any) => {
  const guildId = event.detail.guildId;
  const config = getConfig(guildId);
  const channelId = config.FC_TRACKING_CHANNEL;

  if (!channelId) {
    console.error(`clanPosts channel not configured for guild ${guildId}`);
    return;
  }

  const stateKey = { pk: guildId, sk: 'state#fc-credit' };
  let lastMessageId: string | undefined;
  try {
    const state = await dynamoDbClient.send(new GetCommand({ TableName: 'BotTable', Key: stateKey }));
    lastMessageId = state.Item?.lastMessageId;
  } catch (e) {
    console.error(e);
  }


  const messages = await getChannelMessages(channelId, undefined, lastMessageId);

  if (messages.length === 0) {
    console.log('No new messages to process for FC credit.');
    return;
  }

  const newLastMessageId = messages[0].id;

  for (const message of messages) {
    if (FC_REGEX.test(message.content)) {
      const author = message.author;
      const points = 2;

      try {
        await dynamoDbClient.send(new UpdateCommand({
          TableName: 'BotTable',
          Key: { pk: guildId, sk: `recruiter#${author.id}` },
          UpdateExpression: 'SET discordName = :name ADD score :points, totalFcs :one',
          ExpressionAttributeValues: {
            ':name': author.username,
            ':points': points,
            ':one': 1,
          },
        }));
      } catch (e) {
        console.error(e);
      }
    }
  }

  await dynamoDbClient.send(new PutCommand({
    TableName: 'BotTable',
    Item: {
      ...stateKey,
      lastMessageId: newLastMessageId,
    },
  }));
};
