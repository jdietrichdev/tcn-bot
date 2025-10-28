import { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { fetchUnrosteredPlayersFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse } from '../adapters/discord-adapter';

export const handleUnrosteredCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
  const players = await fetchUnrosteredPlayersFromCSV();
    const content = players.length
      ? `**Unrostered Players:**\n${players.map(p => `- ${p}`).join('\n')}`
      : 'No unrostered players found.';
    await updateResponse(interaction.application_id, interaction.token, { content });
  } catch (err) {
    console.error('Failed to fetch unrostered players:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to fetch unrostered players. Please try again or contact an admin.',
    });
  }
};
