import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1021786969077973022';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { status, userId = 'web-user' } = body;

    const now = new Date().toISOString();
    
    const updateExpressions: string[] = ['#status = :status'];
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    const expressionAttributeValues: Record<string, any> = { ':status': status };

    if (status === 'claimed') {
      updateExpressions.push('claimedAt = :claimedAt', 'claimedBy = :claimedBy');
      expressionAttributeValues[':claimedAt'] = now;
      expressionAttributeValues[':claimedBy'] = userId;
    } else if (status === 'completed') {
      updateExpressions.push('completedAt = :completedAt', 'completedBy = :completedBy');
      expressionAttributeValues[':completedAt'] = now;
      expressionAttributeValues[':completedBy'] = userId;
    } else if (status === 'approved') {
      updateExpressions.push('approvedAt = :approvedAt', 'approvedBy = :approvedBy');
      expressionAttributeValues[':approvedAt'] = now;
      expressionAttributeValues[':approvedBy'] = userId;
    }

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: GUILD_ID,
          sk: `task#${taskId}`,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: 'BotTable',
        Key: {
          pk: GUILD_ID,
          sk: `task#${taskId}`,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}