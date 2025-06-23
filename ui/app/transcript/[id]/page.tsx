import { fetchTranscript } from "@/utils/transcriptHelper";
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
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
        {JSON.stringify(transcript, null, 2)}
      </pre>
    </main>
  )
}