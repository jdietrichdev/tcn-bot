import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1111490767991615518';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId') || GUILD_ID;

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
    const body = await request.json();
    
    const now = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    
    const newTask = {
      ...body,
      taskId,
      status: 'pending',
      createdAt: now,
    };

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

    return NextResponse.json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}