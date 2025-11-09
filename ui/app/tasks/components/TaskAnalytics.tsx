'use client';

import { Task } from '../types/Task';
import { useState, useEffect } from 'react';
import { TrophyIcon, ClockIcon, ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { fetchAnalyticsData, CompletedTask as AnalyticsTask } from '@/utils/analyticsHelper';

interface TaskAnalyticsProps {
  tasks: Task[];
  completedTasks?: Task[];
}

interface UserStats {
  userId: string;
  username?: string;
  tasksCompleted: number;
  tasksCreated: number;
  tasksClaimed: number;
  avgCompletionTime: number;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

export function TaskAnalytics({ tasks, completedTasks = [] }: TaskAnalyticsProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'all'>('month');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const guildId = process.env.NEXT_PUBLIC_GUILD_ID || '1021786969077973022';
        const data = await fetchAnalyticsData(guildId);
        setAnalyticsData(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Filter tasks by timeframe
  const getFilteredTasks = (taskList: Task[]) => {
    const now = new Date();
    const timeframeDays = selectedTimeframe === 'week' ? 7 : selectedTimeframe === 'month' ? 30 : 999999;
    const cutoffDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    return taskList.filter(task => new Date(task.createdAt) >= cutoffDate);
  };

  const getFilteredAnalytics = () => {
    const now = new Date();
    const timeframeDays = selectedTimeframe === 'week' ? 7 : selectedTimeframe === 'month' ? 30 : 999999;
    const cutoffDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    return analyticsData.filter(task => new Date(task.approvedAt) >= cutoffDate);
  };

  const filteredTasks = getFilteredTasks([...tasks, ...completedTasks]);
  const filteredActiveTasks = getFilteredTasks(tasks);
  const filteredCompletedTasks = getFilteredAnalytics();

  // Calculate user statistics
  const getUserStats = (): UserStats[] => {
    const userMap = new Map<string, UserStats>();

    // Process active tasks
    filteredTasks.forEach(task => {
      // Track task creation
      if (task.createdBy) {
        if (!userMap.has(task.createdBy)) {
          userMap.set(task.createdBy, {
            userId: task.createdBy,
            tasksCompleted: 0,
            tasksCreated: 0,
            tasksClaimed: 0,
            avgCompletionTime: 0,
            priorityBreakdown: { high: 0, medium: 0, low: 0 }
          });
        }
        const user = userMap.get(task.createdBy)!;
        user.tasksCreated++;
      }

      // Track task claiming
      if (task.claimedBy) {
        if (!userMap.has(task.claimedBy)) {
          userMap.set(task.claimedBy, {
            userId: task.claimedBy,
            tasksCompleted: 0,
            tasksCreated: 0,
            tasksClaimed: 0,
            avgCompletionTime: 0,
            priorityBreakdown: { high: 0, medium: 0, low: 0 }
          });
        }
        const user = userMap.get(task.claimedBy)!;
        user.tasksClaimed++;
      }
    });

    // Process completed tasks from analytics
    filteredCompletedTasks.forEach(task => {
      // Track task completion
      if (task.completedBy) {
        if (!userMap.has(task.completedBy)) {
          userMap.set(task.completedBy, {
            userId: task.completedBy,
            tasksCompleted: 0,
            tasksCreated: 0,
            tasksClaimed: 0,
            avgCompletionTime: 0,
            priorityBreakdown: { high: 0, medium: 0, low: 0 }
          });
        }
        const user = userMap.get(task.completedBy)!;
        user.tasksCompleted++;
        user.priorityBreakdown[task.priority]++;

        // Calculate completion time
        if (task.claimedAt && task.completedAt) {
          const claimedTime = new Date(task.claimedAt).getTime();
          const completedTime = new Date(task.completedAt).getTime();
          const completionTimeHours = (completedTime - claimedTime) / (1000 * 60 * 60);
          user.avgCompletionTime = user.avgCompletionTime === 0 ? completionTimeHours : (user.avgCompletionTime + completionTimeHours) / 2;
        }
      }

      // Track task creation from completed tasks
      if (task.createdBy && !userMap.has(task.createdBy)) {
        userMap.set(task.createdBy, {
          userId: task.createdBy,
          tasksCompleted: 0,
          tasksCreated: 1,
          tasksClaimed: 0,
          avgCompletionTime: 0,
          priorityBreakdown: { high: 0, medium: 0, low: 0 }
        });
      } else if (task.createdBy && userMap.has(task.createdBy)) {
        const user = userMap.get(task.createdBy)!;
        user.tasksCreated++;
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  };

  const userStats = getUserStats();

  // Calculate overall statistics
  const totalActiveTasks = filteredActiveTasks.length;
  const totalCompletedTasks = filteredCompletedTasks.length;
  const pendingTasks = filteredActiveTasks.filter(t => t.status === 'pending').length;
  const claimedTasks = filteredActiveTasks.filter(t => t.status === 'claimed').length;
  const totalTasks = totalActiveTasks + totalCompletedTasks;
  const completionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;

  // Priority distribution
  const allTasksForPriority = [...filteredActiveTasks, ...filteredCompletedTasks];
  const priorityStats = {
    high: allTasksForPriority.filter(t => t.priority === 'high').length,
    medium: allTasksForPriority.filter(t => t.priority === 'medium').length,
    low: allTasksForPriority.filter(t => t.priority === 'low').length,
  };

  // Average completion time
  const avgCompletionTime = userStats.length > 0 
    ? userStats.reduce((sum, user) => sum + user.avgCompletionTime, 0) / userStats.length 
    : 0;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">📊 Task Analytics</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6" />
          Task Analytics
        </h2>
        
        {/* Timeframe Selector */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['week', 'month', 'all'] as const).map((timeframe) => (
            <button
              key={timeframe}
              onClick={() => setSelectedTimeframe(timeframe)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedTimeframe === timeframe
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {timeframe === 'week' ? '7 Days' : timeframe === 'month' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Tasks</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{totalTasks}</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-300">{totalCompletedTasks}</p>
            </div>
            <TrophyIcon className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Completion Rate</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{completionRate}%</p>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Time</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                {avgCompletionTime.toFixed(1)}h
              </p>
            </div>
            <UserGroupIcon className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Priority Distribution</h3>
        <div className="space-y-3">
          {Object.entries(priorityStats).map(([priority, count]) => {
            const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
            const colors = {
              high: 'bg-red-500',
              medium: 'bg-yellow-500',
              low: 'bg-green-500',
            };
            
            return (
              <div key={priority} className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {priority}
                </div>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${colors[priority as keyof typeof colors]}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-sm text-gray-600 dark:text-gray-400">
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Contributors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Contributors</h3>
        <div className="space-y-3">
          {userStats.slice(0, 5).map((user, index) => (
            <div key={user.userId} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {index + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  User {user.userId.slice(-4)}
                </p>
                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Completed: {user.tasksCompleted}</span>
                  <span>Created: {user.tasksCreated}</span>
                  <span>Avg: {user.avgCompletionTime.toFixed(1)}h</span>
                </div>
              </div>
              <div className="flex gap-1">
                {user.priorityBreakdown.high > 0 && (
                  <span className="w-2 h-2 bg-red-500 rounded-full" title={`${user.priorityBreakdown.high} high priority`} />
                )}
                {user.priorityBreakdown.medium > 0 && (
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" title={`${user.priorityBreakdown.medium} medium priority`} />
                )}
                {user.priorityBreakdown.low > 0 && (
                  <span className="w-2 h-2 bg-green-500 rounded-full" title={`${user.priorityBreakdown.low} low priority`} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Status Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{pendingTasks}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{claimedTasks}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCompletedTasks}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
      </div>
    </div>
  );
}