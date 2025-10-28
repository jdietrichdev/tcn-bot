import { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { fetchUnrosteredPlayersFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse } from '../adapters/discord-adapter';

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

    let content = `**Unrostered Players (${players.length}):**\n${escapedPlayers.map(p => `- ${p}`).join('\n')}`;
    
    if (content.length > 2000) {
      content = `**Unrostered Players (${players.length}):**\n${escapedPlayers.slice(0, 50).map(p => `- ${p}`).join('\n')}\n\n_...and ${players.length - 50} more (list truncated due to length)_`;
    }
    
    await updateResponse(interaction.application_id, interaction.token, { content });
  } catch (err) {
    console.error('Failed to fetch unrostered players:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Failed to fetch unrostered players: ${errorMessage}`,
    });
  }
};
