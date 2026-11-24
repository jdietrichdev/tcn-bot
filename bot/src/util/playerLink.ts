import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../clients/dynamodb-client';

export const normalizePlayerTag = (input: string): string => {
  const tag = input.trim().replace(/^#/, '').toUpperCase();
  if (!/^[A-Z0-9]+$/.test(tag)) {
    throw new Error('Invalid player tag');
  }
  return `#${tag}`;
};

export const findPlayerLinks = async (tag: string) => {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const result = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        IndexName: 'sk-index',
        KeyConditionExpression: 'sk = :sk',
        ExpressionAttributeValues: { ':sk': `player#${tag.substring(1)}` },
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
};
