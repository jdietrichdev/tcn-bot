import { Task } from '../types/Task';

const API_BASE_URL = process.env.NEXT_PUBLIC_TASK_API_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod';
const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1111490767991615518';

export async function fetchTasks(guildId?: string): Promise<Task[]> {
  if (API_BASE_URL.includes('your-api-gateway-url')) {
    console.log('Using mock data - AWS API not yet configured');
    return getMockTasks();
  }
  
  try {
    const targetGuildId = guildId || GUILD_ID;
    const url = `${API_BASE_URL}/tasks?guildId=${targetGuildId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
    }

    const tasks = await response.json();
    
    return tasks.map((task: any) => ({
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
    }));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    
    console.log('Falling back to mock data...');
    return getMockTasks();
  }
}

export async function createTask(task: Omit<Task, 'taskId' | 'createdAt' | 'status'>): Promise<Task> {
  try {
    const url = `${API_BASE_URL}/tasks?guildId=${GUILD_ID}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.status} ${response.statusText}`);
    }

    const createdTask = await response.json();
    return createdTask;
  } catch (error) {
    console.error('Error creating task:', error);
    throw new Error('Failed to create task');
  }
}

export async function updateTaskStatus(taskId: string, status: Task['status'], userId?: string): Promise<void> {
  try {
    const url = `${API_BASE_URL}/tasks/${taskId}?guildId=${GUILD_ID}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        userId: userId || 'web-user',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task status: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating task status:', error);
    throw new Error('Failed to update task status');
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    const url = `${API_BASE_URL}/tasks/${taskId}?guildId=${GUILD_ID}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete task: ${response.status} ${response.statusText}`);
    }
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