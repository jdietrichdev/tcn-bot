export function TaskCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-l-4 border-l-gray-300 dark:border-l-gray-600 shadow-sm animate-pulse">
      <div className="p-3 md:p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 md:mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
          <div className="w-12 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>

        {/* Title */}
        <div className="w-3/4 h-5 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>

        {/* Description */}
        <div className="space-y-2 mb-3">
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>

        {/* Roles */}
        <div className="flex gap-1 mb-3">
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Metadata */}
        <div className="space-y-1 mb-3">
          <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-28 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-gray-300 dark:bg-gray-600 rounded-md"></div>
          <div className="w-20 h-9 bg-gray-300 dark:bg-gray-600 rounded-md"></div>
        </div>
      </div>
    </div>
  );
}

export function TaskColumnSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      {/* Column Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-24 h-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          <div className="ml-2 w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Task Cards */}
      <div className="space-y-2 md:space-y-3">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header Skeleton */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="w-80 h-10 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2"></div>
              <div className="w-64 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
              <div className="w-24 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm mb-6 md:mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-2 animate-pulse"></div>
                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm mb-6 md:mb-8">
          <div className="w-20 h-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="w-full h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Columns Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          <TaskColumnSkeleton />
          <TaskColumnSkeleton />
          <TaskColumnSkeleton />
          <TaskColumnSkeleton />
        </div>
      </div>
    </div>
  );
}