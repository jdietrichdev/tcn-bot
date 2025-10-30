import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fetchUnrosteredPlayersFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { fetchPlayersWithDetailsFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { refreshUnrosteredMessages } from '../component-handlers/unrosteredButton';
import { getPlayerCWLLeague, getPlayerWarHitRate } from '../adapters/clashking-adapter';
import { fetchCWLResponses } from '../util/fetchCWLResponses';

export const handleRosterAdd = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const playerNameOption = interaction.data.options?.find(
      (opt) => opt.name === 'player-name'
    ) as APIApplicationCommandInteractionDataStringOption;
    const rosterNameOption = interaction.data.options?.find(
      (opt) => opt.name === 'roster-name'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!playerNameOption || !rosterNameOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'Missing required parameters.',
      });
      return;
    }

    const playerName = playerNameOption.value;
    const selectedRosterName = rosterNameOption.value;
    const guildId = interaction.guild_id!;

    const allPlayers = await fetchUnrosteredPlayersFromCSV();
    const playerExists = allPlayers.some(p => p.trim() === playerName.trim());
    
    if (!playerExists) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Player **${playerName}** not found in the signup list.`,
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

    if (!rostersResult.Items || rostersResult.Items.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ No rosters found. Create a roster first with `/create-roster`.',
      });
      return;
    }

    const roster = rostersResult.Items.find(
      (r) => r.clanName && r.clanName.toLowerCase() === selectedRosterName.toLowerCase()
    );

    if (!roster) {
      const availableRosters = rostersResult.Items
        .map((r) => `**${r.clanName}**`)
        .join(', ');
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Roster **${selectedRosterName}** not found.\n\nAvailable rosters: ${availableRosters}`,
      });
      return;
    }

    const players = roster.players || [];

    if (players.some((p: any) => p.playerName === playerName)) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Player **${playerName}** is already in the roster **${roster.clanName}**.`,
      });
      return;
    }

    const playerInAnotherRoster = rostersResult.Items.find((r) => {
      if (r.sk === roster.sk) return false;
      const rosterPlayers = r.players || [];
      return rosterPlayers.some((p: any) => p.playerName === playerName);
    });

    if (playerInAnotherRoster) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `⚠️ Player **${playerName}** is already in roster **${playerInAnotherRoster.clanName}**.\nRemove them from that roster first.`,
      });
      return;
    }

    players.push({
      playerName,
      addedAt: new Date().toISOString(),
      addedBy: interaction.member!.user.id,
    });

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: roster.sk,
        },
        UpdateExpression: 'SET players = :players',
        ExpressionAttributeValues: {
          ':players': players,
        },
      })
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Added **${playerName}** to roster **${roster.clanName}** (Rank ${roster.clanRank})\nTotal players: ${players.length}`,
    });
    
    try {
      const allPlayers = await fetchPlayersWithDetailsFromCSV();
      
      const rostersResultRefresh = await dynamoDbClient.send(
        new QueryCommand({
          TableName: 'BotTable',
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
          ExpressionAttributeValues: {
            ':pk': guildId,
            ':sk': 'roster#',
          },
        })
      );
      
      const rosteredPlayersSet = new Set<string>();
      if (rostersResultRefresh.Items) {
        for (const rosterItem of rostersResultRefresh.Items) {
          if (rosterItem.players && Array.isArray(rosterItem.players)) {
            for (const player of rosterItem.players) {
              if (player.playerName) {
                rosteredPlayersSet.add(player.playerName.trim());
              }
            }
          }
        }
      }
      
      const unrosteredPlayers = allPlayers.filter(
        player => !rosteredPlayersSet.has(player.name.trim())
      );
      
      let cwlResponses: any[] = [];
      try {
        cwlResponses = await fetchCWLResponses();
      } catch (error) {
        console.error('Failed to fetch CWL responses:', error);
      }
      
      const cwlSignupMap = new Map(
        cwlResponses.map((r: any) => [r.username.toLowerCase(), true])
      );
      
      const playersWithLeague = [];
      const batchSize = 25;
      const delayBetweenBatches = 1000;
      
      for (let i = 0; i < unrosteredPlayers.length; i += batchSize) {
        const batch = unrosteredPlayers.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (player: any) => {
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
      
      await refreshUnrosteredMessages(sortedPlayers, allPlayers.length);
    } catch (error) {
      console.error('Failed to refresh unrostered messages:', error);
    }
  } catch (err) {
    console.error('Failed to add player to roster:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to add player to roster. Please try again or contact an admin.',
    });
  }
};
