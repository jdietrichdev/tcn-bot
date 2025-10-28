import { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { fetchUnrosteredPlayersFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse, sendFollowupMessage } from '../adapters/discord-adapter';

export const handleUnrosteredCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const players = await fetchUnrosteredPlayersFromCSV();
    
    if (!players || players.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'No unrostered players found.',
      });
      return;
    }

    const escapedPlayers = players.map(p => p.replace(/_/g, "\\_"));

    const header = `**Unrostered Players (${players.length} total):**\n`;
    const maxChunkSize = 1900; 
    const chunks: string[][] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const player of escapedPlayers) {
      const line = `- ${player}\n`;
      if (currentLength + line.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentLength = 0;
      }
      currentChunk.push(player);
      currentLength += line.length;
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const firstContent = header + chunks[0].map(p => `- ${p}`).join('\n');
    await updateResponse(interaction.application_id, interaction.token, { 
      content: firstContent
    });

    for (let i = 1; i < chunks.length; i++) {
      const content = `**Continued (${i + 1}/${chunks.length}):**\n` + 
                     chunks[i].map(p => `- ${p}`).join('\n');
      await sendFollowupMessage(interaction.application_id, interaction.token, { 
        content
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error('Failed to fetch unrostered players:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Failed to fetch unrostered players: ${errorMessage}`,
    });
  }
};
