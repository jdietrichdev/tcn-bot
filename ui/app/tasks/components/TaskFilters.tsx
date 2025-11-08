import { Task, TaskStatus, TaskPriority } from '../types/Task';

interface TaskFiltersProps {
  filters: {
    status: TaskStatus | 'all';
    priority: TaskPriority | 'all';
    assignedRole: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  tasks: Task[];
}

export function TaskFilters({ filters, onFiltersChange, tasks }: TaskFiltersProps) {
  const uniqueRoles = Array.from(
    new Set(
      tasks.flatMap(task => task.assignedRoles || [])
    )
  ).sort();

  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm mb-6 md:mb-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">🔍 Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Tasks
          </label>
          <input
            type="text"
            id="search"
            placeholder="Search title or description..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-base touch-target"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-base touch-target"
          >
            <option value="all">All Status</option>
            <option value="pending">🟡 Pending</option>
            <option value="claimed">🔵 Claimed</option>
            <option value="completed">✅ Ready for Review</option>
            <option value="approved">✅ Approved</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Priority
          </label>
          <select
            id="priority"
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-base touch-target"
          >
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>

        {/* Role Filter */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Assigned Role
          </label>
          <select
            id="role"
            value={filters.assignedRole}
            onChange={(e) => updateFilter('assignedRole', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-base touch-target"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.search || filters.status !== 'all' || filters.priority !== 'all' || filters.assignedRole !== 'all') && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
          
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-sm">
              Search: &quot;{filters.search}&quot;
              <button
                onClick={() => updateFilter('search', '')}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          
          {filters.status !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-sm">
              Status: {filters.status}
              <button
                onClick={() => updateFilter('status', 'all')}
                className="ml-1 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          )}
          
          {filters.priority !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-sm">
              Priority: {filters.priority}
              <button
                onClick={() => updateFilter('priority', 'all')}
                className="ml-1 text-yellow-600 hover:text-yellow-800"
              >
                ×
              </button>
            </span>
          )}
          
          {filters.assignedRole !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded text-sm">
              Role: {filters.assignedRole}
              <button
                onClick={() => updateFilter('assignedRole', 'all')}
                className="ml-1 text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          )}

          <button
            onClick={() => onFiltersChange({
              status: 'all',
              priority: 'all',
              assignedRole: 'all',
              search: '',
            })}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}