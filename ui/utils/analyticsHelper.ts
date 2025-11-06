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
    const response = await fetch(`/api/analytics?guildId=${guildId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as CompletedTask[];
  } catch (err) {
    console.error('Failed to fetch analytics data:', err);
    throw err;
  }
};

export const fetchTasks = async (guildId: string = '1111490767991615518'): Promise<any[]> => {
  try {
    const response = await fetch(`/api/tasks?guildId=${guildId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
    throw err;
  }
};