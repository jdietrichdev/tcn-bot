import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoDbClient } from './clients/dynamodb-client';
import { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const taskApi = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Task API Event:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { httpMethod, path, pathParameters, queryStringParameters, body } = event;
    const guildId = queryStringParameters?.guildId || '1111490767991615518';

    switch (httpMethod) {
      case 'GET':
        if (path === '/api/tasks' || path.endsWith('/tasks')) {
          return await getTasks(guildId, queryStringParameters);
        } else if (pathParameters?.taskId) {
          return await getTask(guildId, pathParameters.taskId);
        }
        break;

      case 'POST':
        if (path === '/api/tasks' || path.endsWith('/tasks')) {
          return await createTask(guildId, JSON.parse(body || '{}'));
        }
        break;

      case 'PUT':
        if (pathParameters?.taskId) {
          return await updateTask(guildId, pathParameters.taskId, JSON.parse(body || '{}'));
        }
        break;

      case 'DELETE':
        if (pathParameters?.taskId) {
          return await deleteTask(guildId, pathParameters.taskId);
        }
        break;

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    console.error('Task API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

async function getTasks(guildId: string, queryParams?: any): Promise<APIGatewayProxyResult> {
  try {
    const { status, priority, assignedRole, search, limit } = queryParams || {};

    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': guildId,
          ':sk': 'task#',
        },
        ScanIndexForward: false,
        Limit: limit ? parseInt(limit) : undefined,
      })
    );

    let tasks = queryResult.Items || [];

    if (status && status !== 'all') {
      tasks = tasks.filter(task => task.status === status);
    }
    
    if (priority && priority !== 'all') {
      tasks = tasks.filter(task => task.priority === priority);
    }
    
    if (assignedRole && assignedRole !== 'all') {
      tasks = tasks.filter(task => 
        task.assignedRoles && task.assignedRoles.includes(assignedRole)
      );
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      tasks = tasks.filter(task => 
        task.title?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower)
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tasks),
    };
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
}

async function getTask(guildId: string, taskId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error fetching task:', error);
    throw error;
  }
}

async function createTask(guildId: string, taskData: any): Promise<APIGatewayProxyResult> {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task = {
      pk: guildId,
      sk: `task#${taskId}`,
      taskId,
      title: taskData.title,
      description: taskData.description,
      status: 'pending',
      priority: taskData.priority || 'medium',
      assignedRoles: taskData.assignedRoles || [],
      createdBy: taskData.createdBy,
      createdAt: now,
      dueDate: taskData.dueDate,
    };

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: task,
      })
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(task),
    };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

async function updateTask(guildId: string, taskId: string, updates: any): Promise<APIGatewayProxyResult> {
  try {
    const now = new Date().toISOString();

    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    if (updates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;

      if (updates.status === 'claimed') {
        updateExpressions.push('claimedAt = :claimedAt', 'claimedBy = :claimedBy');
        expressionAttributeValues[':claimedAt'] = now;
        expressionAttributeValues[':claimedBy'] = updates.userId;
      } else if (updates.status === 'completed') {
        updateExpressions.push('completedAt = :completedAt', 'completedBy = :completedBy');
        expressionAttributeValues[':completedAt'] = now;
        expressionAttributeValues[':completedBy'] = updates.userId;
      } else if (updates.status === 'approved') {
        updateExpressions.push('approvedAt = :approvedAt', 'approvedBy = :approvedBy');
        expressionAttributeValues[':approvedAt'] = now;
        expressionAttributeValues[':approvedBy'] = updates.userId;
      } else if (updates.status === 'pending') {
        updateExpressions.push(
          'claimedAt = :null',
          'claimedBy = :null',
          'completedAt = :null',
          'completedBy = :null'
        );
        expressionAttributeValues[':null'] = null;
      }
    }

    if (updates.title !== undefined) {
      updateExpressions.push('title = :title');
      expressionAttributeValues[':title'] = updates.title;
    }

    if (updates.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = updates.description;
    }

    if (updates.priority !== undefined) {
      updateExpressions.push('priority = :priority');
      expressionAttributeValues[':priority'] = updates.priority;
    }

    if (updates.assignedRoles !== undefined) {
      updateExpressions.push('assignedRoles = :assignedRoles');
      expressionAttributeValues[':assignedRoles'] = updates.assignedRoles;
    }

    if (updates.dueDate !== undefined) {
      updateExpressions.push('dueDate = :dueDate');
      expressionAttributeValues[':dueDate'] = updates.dueDate;
    }

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No valid updates provided' }),
      };
    }

    const result = await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ReturnValues: 'ALL_NEW',
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes),
    };
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

async function deleteTask(guildId: string, taskId: string): Promise<APIGatewayProxyResult> {
  try {
    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    return {
      statusCode: 204,
      headers,
      body: '',
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}