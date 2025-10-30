import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption, APIEmbed, ComponentType, ButtonStyle } from "discord-api-types/v10";
import { updateResponse, getOriginalResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchPlayersWithDetailsFromCSV, PlayerData } from "../util/fetchUnrosteredPlayersCSV";
import { getPlayerCWLLeague, getPlayerWarHitRate } from "../adapters/clashking-adapter";
import { v4 as uuidv4 } from 'uuid';
import { storeCacheInDynamoDB } from "../component-handlers/rosterShowButton";

export const handleRosterShow = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  const rosterNameOption = interaction.data.options?.find(
    (opt) => opt.name === "roster-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const rosterName = rosterNameOption?.value;

  if (!guildId) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ This command can only be used in a server.",
    });
  }

  if (!rosterName) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Roster name is required.",
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
        content: "❌ No rosters found. Create one using `/create-roster` first.",
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

    let allPlayerDetails: PlayerData[] = [];
    try {
      allPlayerDetails = await fetchPlayersWithDetailsFromCSV();
    } catch (error) {
      console.error("Failed to fetch player details from CSV:", error);
    }

    const playerDetailsMap = new Map(
      allPlayerDetails.map(p => [p.name.toLowerCase().trim(), p])
    );

    const playersWithData: Array<{ playerName: string; cwlLeague: string; warHitRate: string }> = [];
    
    if (roster.players && roster.players.length > 0) {
      const batchSize = 25;
      const delayBetweenBatches = 1000;
      
      for (let i = 0; i < roster.players.length; i += batchSize) {
        const batch = roster.players.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (player: { playerName: string }) => {
            const details = playerDetailsMap.get(player.playerName.toLowerCase().trim());
            if (details?.playerTag && details.playerTag.trim()) {
              try {
                const [cwlLeague, hitRateData] = await Promise.all([
                  getPlayerCWLLeague(details.playerTag),
                  getPlayerWarHitRate(details.playerTag)
                ]);
                
                const warHitRate = hitRateData 
                  ? `${hitRateData.threeStars}/${hitRateData.totalAttacks} (${hitRateData.hitRate}%)`
                  : 'N/A';
                
                return {
                  playerName: player.playerName,
                  cwlLeague,
                  warHitRate,
                };
              } catch (error) {
                console.error(`Failed to fetch data for ${player.playerName}:`, error);
                return {
                  playerName: player.playerName,
                  cwlLeague: 'Unknown',
                  warHitRate: 'N/A',
                };
              }
            }
            return {
              playerName: player.playerName,
              cwlLeague: 'No Tag',
              warHitRate: 'N/A',
            };
          })
        );
        
        playersWithData.push(...batchResults);
        
        if (i + batchSize < roster.players.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }

    const cwlLeagueMap = new Map(
      playersWithData.map(p => [p.playerName.toLowerCase().trim(), p.cwlLeague])
    );
    
    const hitRateMap = new Map(
      playersWithData.map(p => [p.playerName.toLowerCase().trim(), p.warHitRate])
    );

    const sortedPlayers = (roster.players || []).sort((a: { playerName: string }, b: { playerName: string }) => {
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

      const aLeague = cwlLeagueMap.get(a.playerName.toLowerCase().trim()) || 'Unknown';
      const bLeague = cwlLeagueMap.get(b.playerName.toLowerCase().trim()) || 'Unknown';
      const aLeagueRank = leagueRank[aLeague] || 20;
      const bLeagueRank = leagueRank[bLeague] || 20;

      if (aLeagueRank !== bLeagueRank) {
        return aLeagueRank - bLeagueRank;
      }

      const aDetails = playerDetailsMap.get(a.playerName.toLowerCase().trim());
      const bDetails = playerDetailsMap.get(b.playerName.toLowerCase().trim());
      const aStars = parseFloat(aDetails?.avgStars || '0') || 0;
      const bStars = parseFloat(bDetails?.avgStars || '0') || 0;
      if (aStars !== bStars) {
        return bStars - aStars; // Descending order
      }

      const aHitRate = hitRateMap.get(a.playerName.toLowerCase().trim());
      const bHitRate = hitRateMap.get(b.playerName.toLowerCase().trim());
      const aRateMatch = aHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
      const bRateMatch = bHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
      const aRate = parseFloat(aRateMatch || '0') || 0;
      const bRate = parseFloat(bRateMatch || '0') || 0;
      
      return bRate - aRate;
    });

    const formatPlayer = (p: { playerName: string }, index: number) => {
      const playerName = p.playerName.replace(/_/g, "\\_");
      const details = playerDetailsMap.get(p.playerName.toLowerCase().trim());
      const cwlLeague = cwlLeagueMap.get(p.playerName.toLowerCase().trim()) || 'Unknown';
      const hitRate = hitRateMap.get(p.playerName.toLowerCase().trim()) || '—';
      
      if (details) {
        const discord = details.discord ? `@${details.discord.replace(/_/g, "\\_")}` : '*Not Set*';
        
        const cwlStars = details.totalCwlStars || '—';
        const stars = details.avgStars || '—';
        const attacks = details.totalAttacks || '—';
        const defStars = details.defenseAvgStars || '—';
        const destruction = details.destruction || '—';
        const missed = details.missed || '—';
        const townHall = details.townHall || '—';
        const heroes = details.combinedHeroes || '—';
        
        return [
          `### ${index + 1}. ${playerName}`,
          `> **Discord:** ${discord}`,
          `> **CWL:** 🎯 \`${hitRate}\` 3★  •  ⭐ \`${cwlStars}\` total  •  🏆 \`${cwlLeague}\``,
          `> **War Attack:** ⭐ \`${stars}\` avg  •  ⚔️ \`${attacks}\` total`,
          `> **War Defense:** 🛡️ \`${defStars}\` avg  •  💥 \`${destruction}%\` dest  •  ❌ \`${missed}\` missed`,
          `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
        ].join('\n');
      }
      
      return [
        `### ${index + 1}. ${playerName}`,
        `> **Discord:** *Unknown*`,
        `> **CWL:** 🎯 \`${hitRate}\` 3★  •  🏆 \`${cwlLeague}\``,
        `> *No stats available from signup sheet*`
      ].join('\n');
    };

    const playersPerPage = 8;
    const pages: any[][] = [];
    for (let i = 0; i < sortedPlayers.length; i += playersPerPage) {
      pages.push(sortedPlayers.slice(i, i + playersPerPage));
    }

    const createEmbed = (currentPage: number): APIEmbed => {
      const startIndex = currentPage * playersPerPage;
      const playerList = pages[currentPage]
        ? pages[currentPage].map((p: { playerName: string }, i: number) => formatPlayer(p, startIndex + i)).join("\n\n")
        : "*No players yet*";

      return {
        title: `🏆 ${roster.clanName}`,
        description: `> **Rank ${roster.clanRank}**  •  **${sortedPlayers?.length || 0} Players**\n\n${playerList}`,
        color: 0x5865F2,
        footer: {
          text: pages.length > 1 
            ? `Page ${currentPage + 1}/${pages.length} • ${sortedPlayers?.length || 0} player${sortedPlayers?.length !== 1 ? 's' : ''} in roster`
            : `${sortedPlayers?.length || 0} player${sortedPlayers?.length !== 1 ? 's' : ''} in roster`
        },
        timestamp: new Date().toISOString()
      };
    };

    const createComponents = (currentPage: number, interactionId: string) => {
      if (pages.length === 1) return [];
      return [{
        type: ComponentType.ActionRow as ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `roster_show_first_${interactionId}`,
            emoji: { name: '⏮️' },
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `roster_show_prev_${interactionId}`,
            emoji: { name: '◀️' },
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `roster_show_page_${interactionId}`,
            label: `${currentPage + 1}/${pages.length}`,
            style: ButtonStyle.Primary as ButtonStyle.Primary,
            disabled: true
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `roster_show_next_${interactionId}`,
            emoji: { name: '▶️' },
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === pages.length - 1
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `roster_show_last_${interactionId}`,
            emoji: { name: '⏭️' },
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === pages.length - 1
          }
        ]
      }];
    };

    const interactionId = uuidv4();
    
    const initialEmbed = createEmbed(0);
    const initialComponents = createComponents(0, interactionId);

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [initialEmbed],
      components: initialComponents
    });

    if (pages.length > 1) {
      const message = await getOriginalResponse(interaction.application_id, interaction.token);
      
      await storeCacheInDynamoDB(interactionId, {
        rosterName: roster.clanName,
        clanRank: roster.clanRank,
        sortedPlayers,
        playerDetailsMap: Array.from(playerDetailsMap.entries()),
        cwlLeagueMap: Array.from(cwlLeagueMap.entries()),
        hitRateMap: Array.from(hitRateMap.entries()),
        channelId: message.channel_id,
        messageId: message.id
      });
    }

    return;
  } catch (error) {
    console.error("Error showing roster:", error);
    console.error("RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while retrieving the roster.",
    });
  }
};
