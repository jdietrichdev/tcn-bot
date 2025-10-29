import { APIChatInputApplicationCommandInteraction, APIEmbed, ButtonStyle, ComponentType } from 'discord-api-types/v10';
import { fetchPlayersWithDetailsFromCSV, PlayerData } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse, sendFollowupMessage } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getPlayerCWLLeague } from '../adapters/clashking-adapter';
import { unrosteredDataCache } from '../component-handlers/unrosteredButton';
import { fetchCWLResponses, CWLResponse } from '../util/fetchCWLResponses';

interface PlayerWithLeague extends PlayerData {
  cwlLeague: string;
  cwlSignedUp?: boolean;
}

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

    let cwlResponses: CWLResponse[] = [];
    try {
      cwlResponses = await fetchCWLResponses();
    } catch (error) {
      console.error('Failed to fetch CWL responses:', error);
    }

    const cwlSignupMap = new Map(
      cwlResponses.map(r => [r.username.toLowerCase(), true])
    );

    const playersWithLeague: PlayerWithLeague[] = [];
    
    const batchSize = 25;
    const delayBetweenBatches = 1000;
    
    for (let i = 0; i < unrosteredPlayers.length; i += batchSize) {
      const batch = unrosteredPlayers.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (player): Promise<PlayerWithLeague> => {
          const cwlSignedUp = cwlSignupMap.has(player.discord.toLowerCase());
          
          if (player.playerTag && player.playerTag.trim()) {
            try {
              const cwlLeague = await getPlayerCWLLeague(player.playerTag);
              return {
                ...player,
                cwlLeague,
                cwlSignedUp,
              };
            } catch (error) {
              console.error(`Failed to fetch CWL league for ${player.name}:`, error);
              return {
                ...player,
                cwlLeague: 'Unknown',
                cwlSignedUp,
              };
            }
          }
          return {
            ...player,
            cwlLeague: 'No Tag',
            cwlSignedUp,
          };
        })
      );
      
      playersWithLeague.push(...batchResults);
      
      if (i + batchSize < unrosteredPlayers.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const formatPlayer = (p: PlayerWithLeague) => {
      const name = p.name.replace(/_/g, "\\_");
      const discord = p.discord ? p.discord.replace(/_/g, "\\_") : 'N/A';
      const stars = p.avgStars || 'N/A';
      const defStars = p.defenseAvgStars || 'N/A';
      const heroes = p.combinedHeroes || 'N/A';
      const destruction = p.destruction || 'N/A';
      const missed = p.missed || 'N/A';
      const league = p.cwlLeague || 'Unknown';
      const responseIcon = p.cwlSignedUp ? '✅' : '❌';
      return `**${name}** ${responseIcon}\n👤 Discord: \`${discord}\`\n⭐ Avg: \`${stars}\` • 🛡️ Def: \`${defStars}\` • 🦸 Heroes: \`${heroes}\`\n💥 Destruction: \`${destruction}\` • ❌ Missed: \`${missed}\`\n🏆 CWL League: \`${league}\``;
    };

    const playersPerPage = 10;
    const pages: PlayerWithLeague[][] = [];
    for (let i = 0; i < playersWithLeague.length; i += playersPerPage) {
      pages.push(playersWithLeague.slice(i, i + playersPerPage));
    }

    const createEmbed = (pageIndex: number): APIEmbed => {
      const page = pages[pageIndex];
      return {
        title: `📋 Unrostered Players`,
        description: page.map(formatPlayer).join('\n\n'),
        color: 0x3498db, // Blue color
        footer: {
          text: `Page ${pageIndex + 1} of ${pages.length} • ${playersWithLeague.length} unrostered of ${allPlayers.length} total players`
        }
      };
    };

    const createComponents = (currentPage: number) => {
      if (pages.length === 1) return [];
      
      return [
        {
          type: ComponentType.ActionRow as ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_first_${interaction.id}`,
              label: '⏮️',
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: currentPage === 0
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_prev_${interaction.id}`,
              label: '◀️',
              style: ButtonStyle.Primary as ButtonStyle.Primary,
              disabled: currentPage === 0
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_page_${interaction.id}`,
              label: `${currentPage + 1}/${pages.length}`,
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: true
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_next_${interaction.id}`,
              label: '▶️',
              style: ButtonStyle.Primary as ButtonStyle.Primary,
              disabled: currentPage === pages.length - 1
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_last_${interaction.id}`,
              label: '⏭️',
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: currentPage === pages.length - 1
            }
          ]
        }
      ];
    };

    unrosteredDataCache.set(interaction.id, playersWithLeague);
    
    setTimeout(() => {
      unrosteredDataCache.delete(interaction.id);
    }, 15 * 60 * 1000);

    await updateResponse(interaction.application_id, interaction.token, { 
      embeds: [createEmbed(0)],
      components: createComponents(0)
    });
  } catch (err) {
    console.error('Failed to fetch unrostered players:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Failed to fetch unrostered players: ${errorMessage}`,
    });
  }
};
