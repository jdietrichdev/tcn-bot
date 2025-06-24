import { fetchTranscript } from "@/utils/transcriptHelper";
import { DiscordMessage, DiscordMessages } from "@skyra/discord-components-react";
import { notFound } from "next/navigation";

export default async function Transcript({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let transcript;

  try {
    transcript = await fetchTranscript(`${id}.json`);
  } catch (err) {
    console.error(`Failed to fetch transcript ${err}`);
    notFound();
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Transcript for {id}</h1>

      <DiscordMessages>
        {transcript.map((message) => {
          return <DiscordMessage key={message.id} content={message.content} author={message.author}
            avatar={message.avatarUrl} timestamp={message.timestamp} />
        })}
      </DiscordMessages>
    </main>
  )
}