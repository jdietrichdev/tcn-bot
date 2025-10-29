import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption, APIEmbed } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchPlayersWithDetailsFromCSV, PlayerData } from "../util/fetchUnrosteredPlayersCSV";
import { getPlayerCWLLeague } from "../adapters/clashking-adapter";

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

    // Fetch player details from CSV
    let allPlayerDetails: PlayerData[] = [];
    try {
      allPlayerDetails = await fetchPlayersWithDetailsFromCSV();
    } catch (error) {
      console.error("Failed to fetch player details from CSV:", error);
    }

    // Create a map for quick lookup
    const playerDetailsMap = new Map(
      allPlayerDetails.map(p => [p.name.toLowerCase().trim(), p])
    );

    // Fetch CWL leagues for all players in the roster (with rate limiting)
    const playersWithLeague: Array<{ playerName: string; cwlLeague: string }> = [];
    
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
                const cwlLeague = await getPlayerCWLLeague(details.playerTag);
                return {
                  playerName: player.playerName,
                  cwlLeague,
                };
              } catch (error) {
                console.error(`Failed to fetch CWL league for ${player.playerName}:`, error);
                return {
                  playerName: player.playerName,
                  cwlLeague: 'Unknown',
                };
              }
            }
            return {
              playerName: player.playerName,
              cwlLeague: 'No Tag',
            };
          })
        );
        
        playersWithLeague.push(...batchResults);
        
        if (i + batchSize < roster.players.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }

    const cwlLeagueMap = new Map(
      playersWithLeague.map(p => [p.playerName.toLowerCase().trim(), p.cwlLeague])
    );

    const formatPlayer = (p: { playerName: string }) => {
      const playerName = p.playerName.replace(/_/g, "\\_");
      const details = playerDetailsMap.get(p.playerName.toLowerCase().trim());
      const cwlLeague = cwlLeagueMap.get(p.playerName.toLowerCase().trim()) || 'Unknown';
      
      if (details) {
        const discord = details.discord || 'N/A';
        const stars = details.avgStars || 'N/A';
        const attacks = details.totalAttacks || 'N/A';
        const defStars = details.defenseAvgStars || 'N/A';
        const heroes = details.combinedHeroes || 'N/A';
        const destruction = details.destruction || 'N/A';
        const missed = details.missed || 'N/A';
        
        return `**${playerName}**\n👤 \`${discord}\` • ⭐ \`${stars}\` • ⚔️ \`${attacks}\` • 🛡️ \`${defStars}\` • 🦸 \`${heroes}\` • 💥 \`${destruction}\` • ❌ \`${missed}\`\n🏆 CWL: \`${cwlLeague}\``;
      }
      
      return `**${playerName}**\n🏆 CWL: \`${cwlLeague}\`\n_No other stats available_`;
    };

    const playerList =
      roster.players && roster.players.length > 0
        ? roster.players.map(formatPlayer).join("\n\n")
        : "_No players yet_";

    const embed: APIEmbed = {
      title: `${roster.clanName}`,
      description: `**Rank:** ${roster.clanRank}\n\n**Players (${roster.players?.length || 0}):**\n\n${playerList}`,
      color: 0x3498db,
      footer: {
        text: `${roster.players?.length || 0} player${roster.players?.length !== 1 ? 's' : ''} in roster`
      }
    };

    return updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed]
    });
  } catch (error) {
    console.error("Error showing roster:", error);
    console.error("RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while retrieving the roster.",
    });
  }
};
