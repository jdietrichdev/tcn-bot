import { APIChatInputApplicationCommandInteraction, APIEmbed, ButtonStyle, ComponentType } from 'discord-api-types/v10';
import { fetchPlayersWithDetailsFromCSV, PlayerData } from '../util/fetchUnrosteredPlayersCSV';
import { updateResponse, sendFollowupMessage, getOriginalResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getPlayerCWLLeague, getPlayerWarHitRate } from '../adapters/clashking-adapter';
import { unrosteredDataCache, storeCacheInDynamoDB } from '../component-handlers/unrosteredButton';
import { fetchCWLResponses, CWLResponse } from '../util/fetchCWLResponses';
import { WAR_LEAGUE } from '../constants/emojis/coc/cwlLeague';

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
              const [cwlLeague, hitRateData] = await Promise.all([
                getPlayerCWLLeague(player.playerTag),
                getPlayerWarHitRate(player.playerTag)
              ]);
              
              const warHitRate = hitRateData 
                ? `${hitRateData.threeStars}/${hitRateData.totalAttacks} (${hitRateData.hitRate}%)`
                : 'N/A';
              
              return {
                ...player,
                cwlLeague,
                cwlSignedUp,
                warHitRate,
              };
            } catch (error) {
              console.error(`Failed to fetch data for ${player.name}:`, error);
              return {
                ...player,
                cwlLeague: 'Unknown',
                cwlSignedUp,
                warHitRate: 'N/A',
              };
            }
          }
          return {
            ...player,
            cwlLeague: 'No Tag',
            cwlSignedUp,
            warHitRate: 'N/A',
          };
        })
      );
      
      playersWithLeague.push(...batchResults);
      
      if (i + batchSize < unrosteredPlayers.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const sortedPlayers = playersWithLeague.sort((a, b) => {
      const leagueRank: Record<string, number> = {
        'Champion League I': 1,
        'Champion League II': 2,
        'Champion League III': 3,
        'Master League I': 4,
        'Master League II': 5,
        'Master League III': 6,
        'Crystal League I': 7,
        'Crystal League II': 8,
        'Crystal League III': 9,
        'Gold League I': 10,
        'Gold League II': 11,
        'Gold League III': 12,
        'Silver League I': 13,
        'Silver League II': 14,
        'Silver League III': 15,
        'Bronze League I': 16,
        'Bronze League II': 17,
        'Bronze League III': 18,
        'Unranked': 19,
        'Unknown': 20,
        'No Tag': 21
      };

      const aLeagueRank = leagueRank[a.cwlLeague || 'Unknown'] || 20;
      const bLeagueRank = leagueRank[b.cwlLeague || 'Unknown'] || 20;

      if (aLeagueRank !== bLeagueRank) {
        return aLeagueRank - bLeagueRank;
      }

      const aStars = parseFloat(a.avgStars) || 0;
      const bStars = parseFloat(b.avgStars) || 0;
      if (aStars !== bStars) {
        return bStars - aStars;
      }

      const aHitRate = a.warHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
      const bHitRate = b.warHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
      const aRate = parseFloat(aHitRate || '0') || 0;
      const bRate = parseFloat(bHitRate || '0') || 0;
      
      return bRate - aRate;
    });

    const formatPlayer = (p: PlayerWithLeague, index: number) => {
      const name = p.name.replace(/_/g, "\\_");
      const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
      const responseIcon = p.cwlSignedUp ? '✅' : '❌';
      
      const hitRate = p.warHitRate || '—';
      const cwlStars = p.totalCwlStars || '—';
      const league = p.cwlLeague || 'Unknown';
      const leagueEmoji = league !== 'Unknown' && league in WAR_LEAGUE ? WAR_LEAGUE[league as keyof typeof WAR_LEAGUE] : '🏆';
      const stars = p.avgStars || '—';
      const attacks = p.totalAttacks || '—';
      const defStars = p.defenseAvgStars || '—';
      const destruction = p.destruction || '—';
      const missed = p.missed || '—';
      const townHall = p.townHall || '—';
      const heroes = p.combinedHeroes || '—';
      
      return [
        `### ${index + 1}. ${name} ${responseIcon}`,
        `> **Discord:** ${discord}`,
        `> **CWL:** ${leagueEmoji} \`${league}\``,
        `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
        `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
        `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
        `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
      ].join('\n');
    };

    const playersPerPage = 6;
    const pages: PlayerWithLeague[][] = [];
    for (let i = 0; i < sortedPlayers.length; i += playersPerPage) {
      pages.push(sortedPlayers.slice(i, i + playersPerPage));
    }

    const createEmbed = (pageIndex: number): APIEmbed => {
      const page = pages[pageIndex];
      const startIndex = pageIndex * playersPerPage;
      
      return {
        title: '📋 Unrostered Players',
        description: page.map((p, i) => formatPlayer(p, startIndex + i)).join('\n\n'),
        color: 0x5865F2,
        footer: {
          text: `Page ${pageIndex + 1} of ${pages.length}  •  ${sortedPlayers.length} unrostered / ${allPlayers.length} total players`
        },
        timestamp: new Date().toISOString()
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
              emoji: { name: '⏮️' },
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: currentPage === 0
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_prev_${interaction.id}`,
              emoji: { name: '◀️' },
              style: ButtonStyle.Primary as ButtonStyle.Primary,
              disabled: currentPage === 0
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_page_${interaction.id}`,
              label: `${currentPage + 1} / ${pages.length}`,
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: true
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_next_${interaction.id}`,
              emoji: { name: '▶️' },
              style: ButtonStyle.Primary as ButtonStyle.Primary,
              disabled: currentPage === pages.length - 1
            },
            {
              type: ComponentType.Button as ComponentType.Button,
              custom_id: `unrostered_last_${interaction.id}`,
              emoji: { name: '⏭️' },
              style: ButtonStyle.Secondary as ButtonStyle.Secondary,
              disabled: currentPage === pages.length - 1
            }
          ]
        }
      ];
    };

    unrosteredDataCache.set(interaction.id, {
      players: sortedPlayers,
      channelId: interaction.channel_id!,
      messageId: '',
      allPlayersCount: allPlayers.length
    });
    
    console.log(`Set cache for interaction ID: ${interaction.id}, cache size: ${unrosteredDataCache.size}`);
    
    setTimeout(() => {
      console.log(`Deleting cache for interaction ID: ${interaction.id}`);
      unrosteredDataCache.delete(interaction.id);
    }, 15 * 60 * 1000);

    await updateResponse(interaction.application_id, interaction.token, { 
      embeds: [createEmbed(0)],
      components: createComponents(0)
    });
    
    try {
      const message = await getOriginalResponse(interaction.application_id, interaction.token);
      const cacheData = unrosteredDataCache.get(interaction.id);
      if (cacheData) {
        cacheData.messageId = message.id;
        console.log(`Cached unrostered message: interaction=${interaction.id}, message=${message.id}, channel=${cacheData.channelId}`);
        
        await storeCacheInDynamoDB(interaction.id, cacheData);
      }
    } catch (error) {
      console.error('Failed to fetch message ID for caching:', error);
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
