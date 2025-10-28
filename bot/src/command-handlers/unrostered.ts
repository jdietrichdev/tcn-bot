import { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { fetchPlayersWithDetailsFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse, sendFollowupMessage } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handleUnrosteredCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = interaction.guild_id!;
    
    const allPlayers = await fetchPlayersWithDetailsFromCSV();
    
    if (!allPlayers || allPlayers.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'No players found in the signup list.',
      });
      return;
    }

    const rostersResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': guildId,
          ':sk': 'roster#',
        },
      })
    );

    const rosteredPlayers = new Set<string>();
    if (rostersResult.Items) {
      for (const roster of rostersResult.Items) {
        if (roster.players && Array.isArray(roster.players)) {
          for (const player of roster.players) {
            if (player.playerName) {
              rosteredPlayers.add(player.playerName.trim());
            }
          }
        }
      }
    }

    const unrosteredPlayers = allPlayers.filter(
      player => !rosteredPlayers.has(player.name.trim())
    );
    
    if (unrosteredPlayers.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '✅ All players have been rostered!',
      });
      return;
    }

    const formatPlayer = (p: typeof unrosteredPlayers[0]) => {
      const name = p.name.replace(/_/g, "\\_");
      const discord = p.discord ? p.discord.replace(/_/g, "\\_") : 'N/A';
      const stars = p.avgStars || 'N/A';
      const defStars = p.defenseAvgStars || 'N/A';
      return `**${name}**\n└ 👤 Discord: \`${discord}\` • ⭐ Avg: \`${stars}\` • 🛡️ Def: \`${defStars}\``;
    };

    const header = `**Unrostered Players (${unrosteredPlayers.length} of ${allPlayers.length} total):**\n`;
    const maxChunkSize = 1800; 
    const chunks: typeof unrosteredPlayers[] = [];
    let currentChunk: typeof unrosteredPlayers = [];
    let currentLength = 0;

    for (const player of unrosteredPlayers) {
      const line = formatPlayer(player) + '\n\n';
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

    const firstContent = header + chunks[0].map(formatPlayer).join('\n\n');
    await updateResponse(interaction.application_id, interaction.token, { 
      content: firstContent
    });

    for (let i = 1; i < chunks.length; i++) {
      const content = `**Continued (${i + 1}/${chunks.length}):**\n` + 
                     chunks[i].map(formatPlayer).join('\n\n');
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
