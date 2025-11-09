export type TaskStatus = 'pending' | 'claimed' | 'completed' | 'approved';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  taskId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedRoles?: string[];
  createdBy?: string;
  claimedBy?: string;
  completedBy?: string;
  approvedBy?: string;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  dueDate?: string;
  completionNotes?: string;
}

export interface TaskFilters {
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  assignedRole: string;
  search: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  claimed: number;
  completed: number;
  approved: number;
  overdue: number;
  highPriority: number;
}