import { Task } from '../types/Task';
import { updateTaskStatus } from '../utils/taskApiClient';

interface TaskCardProps {
  task: Task;
  onTaskUpdate: () => void;
}

export function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'low': return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      default: return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
    }
  };

  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'pending': return '🟡';
      case 'claimed': return '🔵';
      case 'completed': return '🟢';
      case 'approved': return '✅';
      default: return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'approved';

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      await updateTaskStatus(task.taskId, newStatus);
      onTaskUpdate();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${isOverdue ? 'ring-2 ring-red-500' : ''}`}>
      <div className="p-3 md:p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 md:mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg md:text-xl">{getPriorityEmoji(task.priority)}</span>
            <span className="text-lg md:text-xl">{getStatusEmoji(task.status)}</span>
            {isOverdue && <span className="text-red-500 text-lg">⏰</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            #{task.taskId.slice(-6)}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 leading-tight text-sm md:text-base">
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-2 md:mb-3 line-clamp-3">
            {task.description}
          </p>
        )}

        {/* Assigned Roles */}
        {task.assignedRoles && task.assignedRoles.length > 0 && (
          <div className="mb-2 md:mb-3">
            <div className="flex flex-wrap gap-1">
              {task.assignedRoles.map(role => (
                <span
                  key={role}
                  className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  @{role}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>Created: {formatDate(task.createdAt)}</div>
          
          {task.claimedAt && (
            <div>Claimed: {formatDate(task.claimedAt)}</div>
          )}
          
          {task.completedAt && (
            <div>Completed: {formatDate(task.completedAt)}</div>
          )}
          
          {task.approvedAt && (
            <div>Approved: {formatDate(task.approvedAt)}</div>
          )}
          
          {task.dueDate && (
            <div className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due: {formatDate(task.dueDate)}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 md:mt-4 flex flex-wrap gap-2">
          {task.status === 'pending' && (
            <button
              onClick={() => handleStatusChange('claimed')}
              className="flex-1 min-w-[100px] px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium touch-target"
            >
              🔵 Claim
            </button>
          )}
          
          {task.status === 'claimed' && (
            <>
              <button
                onClick={() => handleStatusChange('completed')}
                className="flex-1 min-w-[90px] px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors font-medium touch-target"
              >
                ✅ Complete
              </button>
              <button
                onClick={() => handleStatusChange('pending')}
                className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors font-medium touch-target"
              >
                ↩️ Unclaim
              </button>
            </>
          )}
          
          {task.status === 'completed' && (
            <button
              onClick={() => handleStatusChange('approved')}
              className="flex-1 min-w-[100px] px-3 py-2 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 transition-colors font-medium touch-target"
            >
              👑 Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}