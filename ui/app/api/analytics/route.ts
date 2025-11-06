import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1111490767991615518';

export async function GET(request: NextRequest) {
  try {
    console.log('API: Fetching analytics data...');
    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId') || GUILD_ID;
    console.log('API: Using guildId:', guildId);

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
    
    console.log('API: Analytics DynamoDB result:', response.Items?.length, 'items');
    const analytics = response.Items || [];

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}