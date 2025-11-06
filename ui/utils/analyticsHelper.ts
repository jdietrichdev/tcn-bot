import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

export interface CompletedTask {
  taskId: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  createdBy: string;
  claimedBy: string;
  completedBy: string;
  approvedBy: string;
  createdAt: string;
  claimedAt: string;
  completedAt: string;
  approvedAt: string;
}

export const fetchAnalyticsData = async (guildId: string = '1111490767991615518'): Promise<CompletedTask[]> => {
  try {
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :guildId AND begins_with(sk, :analyticsPrefix)',
        ExpressionAttributeValues: {
          ':guildId': guildId,
          ':analyticsPrefix': 'analytics#task#',
        },
      })
    );
    
    return (response.Items || []) as CompletedTask[];
  } catch (err) {
    console.error('Failed to fetch analytics data:', err);
    throw err;
  }
};

export const fetchTasks = async (guildId: string = '1111490767991615518'): Promise<any[]> => {
  try {
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :guildId AND begins_with(sk, :taskPrefix)',
        ExpressionAttributeValues: {
          ':guildId': guildId,
          ':taskPrefix': 'task#',
        },
      })
    );
    
    return response.Items || [];
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
    throw err;
  }
};