import { fetchCWLResponses, CWLResponse } from "./fetchCWLResponses";

export async function getPlayerNotes(discord: string, playerName: string): Promise<string> {
  const responses: CWLResponse[] = await fetchCWLResponses();
  const match = responses.find(
    r => r.discordId === discord || r.username.toLowerCase() === playerName.toLowerCase()
  );
  if (!match) return "";
  return `League: ${match.league} / Availability: ${match.availability} / Competitiveness: ${match.competitiveness} / Other notes: ${match.otherNotes}`;
}
