import { Task } from '../types/Task';

interface TaskStatsProps {
  tasks: Task[];
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    claimed: tasks.filter(t => t.status === 'claimed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    approved: tasks.filter(t => t.status === 'approved').length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'approved').length,
    highPriority: tasks.filter(t => t.priority === 'high' && t.status !== 'approved').length,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-blue-600">{stats.claimed}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Claimed</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Approved</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="text-2xl font-bold text-orange-600">{stats.highPriority}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">High Priority</div>
      </div>
    </div>
  );
}