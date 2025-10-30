import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { fetchPlayersWithDetailsFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { refreshUnrosteredMessages } from '../component-handlers/unrosteredButton';
import { getPlayerCWLLeague, getPlayerWarHitRate } from '../adapters/clashking-adapter';
import { fetchCWLResponses } from '../util/fetchCWLResponses';

export const handleRosterRemove = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  const playerNameOption = interaction.data.options?.find(
    (opt) => opt.name === "player-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const rosterNameOption = interaction.data.options?.find(
    (opt) => opt.name === "roster-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const playerName = playerNameOption?.value;
  const rosterName = rosterNameOption?.value;

  if (!guildId) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ This command can only be used in a server.",
    });
  }

  if (!playerName || !rosterName) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Player name and roster name are required.",
    });
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "roster#",
        },
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: "❌ No rosters found.",
      });
    }

    const roster = queryResult.Items.find(
      (item) => item.clanName?.toLowerCase() === rosterName.toLowerCase()
    );

    if (!roster) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Roster "${rosterName}" not found. Use autocomplete to see available rosters.`,
      });
    }

    const playerIndex = roster.players?.findIndex(
      (p: { playerName: string }) =>
        p.playerName.toLowerCase() === playerName.toLowerCase()
    );

    if (playerIndex === -1 || playerIndex === undefined) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Player "${playerName}" is not in the roster "${rosterName}".`,
      });
    }

    const updatedPlayers = [...roster.players];
    updatedPlayers.splice(playerIndex, 1);

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: "BotTable",
        Key: {
          pk: roster.pk,
          sk: roster.sk,
        },
        UpdateExpression: "SET players = :players",
        ExpressionAttributeValues: {
          ":players": updatedPlayers,
        },
      })
    );

    return updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Successfully removed **${playerName.replace(
        /_/g,
        "\\_"
      )}** from roster **${rosterName.replace(/_/g, "\\_")}**.`,
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
      const items = rostersResultRefresh.Items || [];
      for (const rosterItem of items) {
        if (rosterItem.players && Array.isArray(rosterItem.players)) {
          for (const player of rosterItem.players) {
            if (player.playerName) {
              rosteredPlayersSet.add(player.playerName.trim());
            }
          }
        }
      }
      
      const unrosteredPlayers = allPlayers.filter(
        player => !rosteredPlayersSet.has(player.name.trim())
      );
      
      // Fetch CWL responses
      let cwlResponses: any[] = [];
      try {
        cwlResponses = await fetchCWLResponses();
      } catch (error) {
        console.error('Failed to fetch CWL responses:', error);
      }
      
      const cwlSignupMap = new Map(
        cwlResponses.map((r: any) => [r.username.toLowerCase(), true])
      );
      
      // Fetch league and hit rate data
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
  } catch (error) {
    console.error("Error removing player from roster:", error);
    console.error("PlayerName:", playerName, "RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while removing the player from the roster.",
    });
  }
};
