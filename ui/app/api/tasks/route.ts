import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1021786969077973022';

export async function GET(request: NextRequest) {
  try {
    console.log('API: Fetching tasks...');
    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId') || GUILD_ID;
    console.log('API: Using guildId:', guildId);

    const result = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :guildId AND begins_with(sk, :taskPrefix)',
        ExpressionAttributeValues: {
          ':guildId': guildId,
          ':taskPrefix': 'task#',
        },
      })
    );

    console.log('API: DynamoDB result:', result.Items?.length, 'items');
    const tasks = (result.Items || []).map((task: any) => ({
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedRoles: task.assignedRoles || [],
      createdBy: task.createdBy,
      claimedBy: task.claimedBy,
      completedBy: task.completedBy,
      approvedBy: task.approvedBy,
      createdAt: task.createdAt,
      claimedAt: task.claimedAt,
      completedAt: task.completedAt,
      approvedAt: task.approvedAt,
      dueDate: task.dueDate,
      completionNotes: task.completionNotes,
    }));

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('API: Creating task...');
    const body = await request.json();
    console.log('API: Task data:', body);
    
    const now = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    
    const newTask = {
      ...body,
      taskId,
      status: 'pending',
      createdAt: now,
    };

    console.log('API: Sending to DynamoDB:', newTask);
    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: GUILD_ID,
          sk: `task#${taskId}`,
          ...newTask,
        },
      })
    );

    console.log('API: Task created successfully');
    return NextResponse.json(newTask);
  } catch (error) {
    console.error('API: Error creating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create task', details: errorMessage }, { status: 500 });
  }
}