import { Task } from '../types/Task';

export async function fetchTasks(guildId?: string): Promise<Task[]> {
  try {
    const url = new URL('/api/tasks', window.location.origin);
    if (guildId) {
      url.searchParams.set('guildId', guildId);
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function createTask(task: Omit<Task, 'taskId' | 'createdAt' | 'status'>): Promise<Task> {
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating task:', error);
    throw new Error('Failed to create task');
  }
}

export async function updateTaskStatus(taskId: string, status: Task['status'], userId?: string): Promise<void> {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task status: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating task status:', error);
    throw new Error('Failed to update task status');
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete task: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    throw new Error('Failed to delete task');
  }
}