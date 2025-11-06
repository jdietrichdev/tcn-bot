import { Task } from '../types/Task';
import { fetchTasks as fetchTasksFromAnalytics } from '@/utils/analyticsHelper';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1111490767991615518';

export async function fetchTasks(guildId?: string): Promise<Task[]> {
  try {
    const targetGuildId = guildId || GUILD_ID;
    const dbTasks = await fetchTasksFromAnalytics(targetGuildId);
    
    return dbTasks.map((task: any) => ({
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
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function createTask(task: Omit<Task, 'taskId' | 'createdAt' | 'status'>): Promise<Task> {
  try {
    const now = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    
    const newTask: Task = {
      ...task,
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

    return newTask;
  } catch (error) {
    console.error('Error creating task:', error);
    throw new Error('Failed to create task');
  }
}

export async function updateTaskStatus(taskId: string, status: Task['status'], userId?: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const user = userId || 'web-user';
    
    const updateExpressions: string[] = ['#status = :status'];
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    const expressionAttributeValues: Record<string, any> = { ':status': status };

    if (status === 'claimed') {
      updateExpressions.push('claimedAt = :claimedAt', 'claimedBy = :claimedBy');
      expressionAttributeValues[':claimedAt'] = now;
      expressionAttributeValues[':claimedBy'] = user;
    } else if (status === 'completed') {
      updateExpressions.push('completedAt = :completedAt', 'completedBy = :completedBy');
      expressionAttributeValues[':completedAt'] = now;
      expressionAttributeValues[':completedBy'] = user;
    } else if (status === 'approved') {
      updateExpressions.push('approvedAt = :approvedAt', 'approvedBy = :approvedBy');
      expressionAttributeValues[':approvedAt'] = now;
      expressionAttributeValues[':approvedBy'] = user;
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
  } catch (error) {
    console.error('Error updating task status:', error);
    throw new Error('Failed to update task status');
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: 'BotTable',
        Key: {
          pk: GUILD_ID,
          sk: `task#${taskId}`,
        },
      })
    );
  } catch (error) {
    console.error('Error deleting task:', error);
    throw new Error('Failed to delete task');
  }
}