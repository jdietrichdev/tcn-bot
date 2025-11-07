'use client';
import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [apiTest, setApiTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const guildIdFromEnv = process.env.NEXT_PUBLIC_GUILD_ID;
  const fallbackGuildId = '1021786969077973022';
  const actualGuildId = guildIdFromEnv || fallbackGuildId;

  useEffect(() => {
    const testApi = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        setApiTest({ success: true, taskCount: data.length, tasks: data.slice(0, 3) });
      } catch (error) {
        setApiTest({ success: false, error: (error as Error).message || 'Unknown error' });
      }
      setLoading(false);
    };
    
    testApi();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <div className="space-y-4">
        <div>
          <h2 className="font-bold">Environment Configuration:</h2>
          <p><strong>Environment Guild ID:</strong> {guildIdFromEnv || 'NOT SET'}</p>
          <p><strong>Fallback Guild ID:</strong> {fallbackGuildId}</p>
          <p><strong>Actual Guild ID Used:</strong> {actualGuildId}</p>
          <p><strong>Build Time:</strong> {new Date().toISOString()}</p>
        </div>
        
        <div>
          <h2 className="font-bold">API Test:</h2>
          {loading ? (
            <p>Testing API...</p>
          ) : (
            <div>
              <p><strong>API Status:</strong> {apiTest.success ? 'SUCCESS' : 'FAILED'}</p>
              <p><strong>Task Count:</strong> {apiTest.success ? apiTest.taskCount : 'N/A'}</p>
              {apiTest.success && apiTest.tasks.length > 0 && (
                <div>
                  <p><strong>Sample Tasks:</strong></p>
                  <ul className="list-disc ml-6">
                    {apiTest.tasks.map((task: any, i: number) => (
                      <li key={i}>{task.title} ({task.status}) - by {task.createdBy}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!apiTest.success && (
                <p><strong>Error:</strong> {apiTest.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}