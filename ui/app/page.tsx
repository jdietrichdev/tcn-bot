import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="TCN Bot logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-4xl font-bold text-center sm:text-left">
          🤖 TCN Bot Dashboard
        </h1>
        <p className="text-lg text-center sm:text-left text-gray-600 dark:text-gray-400">
          Welcome to the TCN Discord Bot management dashboard. Choose a feature below to get started.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* Task Management */}
          <Link 
            href="/tasks"
            className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="text-4xl">📋</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Task Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  View and manage community tasks, track progress, and collaborate with team members.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-medium">
              View Tasks Dashboard →
            </div>
          </Link>

          {/* Roster Upload */}
          <Link 
            href="/roster-upload"
            className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="text-4xl">👥</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Roster Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Upload and manage clan rosters, track member activities and statistics.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-medium">
              Manage Rosters →
            </div>
          </Link>

          {/* Transcript */}
          <Link 
            href="/transcript"
            className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="text-4xl">📝</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Transcripts
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  View and manage Discord conversation transcripts and logs.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-medium">
              View Transcripts →
            </div>
          </Link>

          {/* Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-6 opacity-60">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🚀</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  More Features
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Additional bot management features coming soon...
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-gray-500 dark:text-gray-500 font-medium">
              Coming Soon
            </div>
          </div>
        </div>
      </main>
      
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        <span>TCN Discord Bot Dashboard</span>
        <span>•</span>
        <span>Built with Next.js</span>
      </footer>
    </div>
  );
}
