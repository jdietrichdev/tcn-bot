import { Task } from '../types/Task';
import { fetchTasks as fetchTasksFromDB } from '@/utils/analyticsHelper';
import { dynamoDbClient } from '@/app/clients/dynamodbClient';
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1111490767991615518';

export async function fetchTasks(guildId?: string): Promise<Task[]> {
  try {
    const targetGuildId = guildId || GUILD_ID;
    
    const dbTasks = await fetchTasksFromDB(targetGuildId);
    
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
    console.error('Error fetching tasks from DynamoDB:', error);
    return getMockTasks();
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

    const putCommand = new PutCommand({
      TableName: 'BotTable',
      Item: {
        pk: GUILD_ID,
        sk: `task#${taskId}`,
        ...newTask,
      },
    });

    await dynamoDbClient.send(putCommand);
    return newTask;
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // For now, return a mock task so the UI doesn't break during development
    const mockTask: Task = {
      ...task,
      taskId: `mock-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    return mockTask;
  }
}

export async function updateTaskStatus(taskId: string, status: Task['status'], userId?: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const user = userId || 'web-user';

    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    updateExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;

    if (status === 'claimed') {
      updateExpressions.push('claimedAt = :claimedAt', 'claimedBy = :claimedBy');
      expressionAttributeValues[':claimedAt'] = now;
      expressionAttributeValues[':claimedBy'] = user;
    } else if (status === 'completed') {
      updateExpressions.push('completedAt = :completedAt', 'completedBy = :completedBy');
      expressionAttributeValues[':completedAt'] = now;
      expressionAttributeValues[':completedBy'] = user;
    } else if (status === 'approved') {
      // When approved, we need to log to analytics and then delete the task
      // For now, just update the status - the Discord bot will handle the deletion
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

function getMockTasks(): Task[] {
  return [
    {
      taskId: 'task-1',
      title: 'Update Discord Bot Documentation',
      description: 'Update the README and add setup instructions for the new task management features',
      status: 'pending',
      priority: 'high',
      assignedRoles: ['Developer', 'Admin'],
      createdBy: 'user123',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      taskId: 'task-2',
      title: 'Design New Server Icons',
      description: 'Create custom emoji and role icons for the server',
      status: 'claimed',
      priority: 'medium',
      assignedRoles: ['Designer'],
      createdBy: 'user456',
      claimedBy: 'user789',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      claimedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      taskId: 'task-3',
      title: 'Organize Community Event',
      description: 'Plan and organize the monthly community game tournament',
      status: 'completed',
      priority: 'high',
      assignedRoles: ['Event Manager', 'Moderator'],
      createdBy: 'user123',
      claimedBy: 'user999',
      completedBy: 'user999',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      claimedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      taskId: 'task-4',
      title: 'Review Clan War Logs',
      description: 'Analyze recent clan war performance and provide feedback',
      status: 'approved',
      priority: 'medium',
      assignedRoles: ['Leader'],
      createdBy: 'user456',
      claimedBy: 'user111',
      completedBy: 'user111',
      approvedBy: 'user123',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      claimedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      taskId: 'task-5',
      title: 'Update Server Rules',
      description: 'Review and update server rules based on recent community feedback',
      status: 'pending',
      priority: 'low',
      assignedRoles: ['Admin', 'Moderator'],
      createdBy: 'user789',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ];
}