'use client';

export default function DebugPage() {
  const guildIdFromEnv = process.env.NEXT_PUBLIC_GUILD_ID;
  const fallbackGuildId = '1021786969077973022';
  const actualGuildId = guildIdFromEnv || fallbackGuildId;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <div className="space-y-2">
        <p><strong>Environment Guild ID:</strong> {guildIdFromEnv || 'NOT SET'}</p>
        <p><strong>Fallback Guild ID:</strong> {fallbackGuildId}</p>
        <p><strong>Actual Guild ID Used:</strong> {actualGuildId}</p>
        <p><strong>Build Time:</strong> {new Date().toISOString()}</p>
      </div>
    </div>
  );
}