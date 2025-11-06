'use client';

import { useState, useEffect } from 'react';
import { TaskCard } from './components/TaskCard';
import { TaskFilters } from './components/TaskFilters';
import { TaskStats } from './components/TaskStats';
import { Task, TaskStatus, TaskPriority } from './types/Task';
import { fetchTasks } from './utils/taskApi';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all' as TaskStatus | 'all',
    priority: 'all' as TaskPriority | 'all',
    assignedRole: 'all',
    search: '',
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const tasksData = await fetchTasks();
      setTasks(tasksData);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.assignedRole !== 'all' && !task.assignedRoles?.includes(filters.assignedRole)) return false;
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase()) && 
        !task.description?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    claimed: filteredTasks.filter(t => t.status === 'claimed'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
    approved: filteredTasks.filter(t => t.status === 'approved'),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            📋 Task Management Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and track community tasks across your Discord server
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-600 dark:text-red-400 mr-2">❌</span>
              <span className="text-red-800 dark:text-red-200">{error}</span>
              <button
                onClick={loadTasks}
                className="ml-auto px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <TaskStats tasks={tasks} />

        {/* Filters */}
        <TaskFilters filters={filters} onFiltersChange={setFilters} tasks={tasks} />

        {/* Task Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Pending Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                🟡 Pending
                <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm">
                  {tasksByStatus.pending.length}
                </span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.pending.map(task => (
                <TaskCard key={task.taskId} task={task} onTaskUpdate={loadTasks} />
              ))}
              {tasksByStatus.pending.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🎉</div>
                  <p>No pending tasks!</p>
                </div>
              )}
            </div>
          </div>

          {/* Claimed Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                🔵 Claimed
                <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {tasksByStatus.claimed.length}
                </span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.claimed.map(task => (
                <TaskCard key={task.taskId} task={task} onTaskUpdate={loadTasks} />
              ))}
              {tasksByStatus.claimed.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">👥</div>
                  <p>No claimed tasks</p>
                </div>
              )}
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                🟢 Completed
                <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm">
                  {tasksByStatus.completed.length}
                </span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.completed.map(task => (
                <TaskCard key={task.taskId} task={task} onTaskUpdate={loadTasks} />
              ))}
              {tasksByStatus.completed.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">⏳</div>
                  <p>No completed tasks</p>
                </div>
              )}
            </div>
          </div>

          {/* Approved Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                ✅ Approved
                <span className="ml-2 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-full text-sm">
                  {tasksByStatus.approved.length}
                </span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.approved.map(task => (
                <TaskCard key={task.taskId} task={task} onTaskUpdate={loadTasks} />
              ))}
              {tasksByStatus.approved.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🏆</div>
                  <p>No approved tasks yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Refreshing...
              </>
            ) : (
              <>
                🔄 Refresh Tasks
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}