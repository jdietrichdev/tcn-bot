import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { stringify } from "csv-stringify/sync";
import { updateResponseWithAttachment } from "../adapters/discord-adapter";
import { fetchPlayersWithDetailsFromCSV, PlayerData } from "../util/fetchUnrosteredPlayersCSV";
import { getPlayerCWLLeague, getPlayerWarHitRate } from "../adapters/clashking-adapter";

export const handleExportRosters = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;

  if (!guildId) {
    throw new Error("This command can only be used in a server.");
  }

  try {
    console.log("Fetching all rosters from DynamoDB...");
    
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
      throw new Error("No rosters found. Create one using `/create-roster` first.");
    }

    console.log(`Found ${queryResult.Items.length} rosters`);

    let allPlayerDetails: PlayerData[] = [];
    try {
      allPlayerDetails = await fetchPlayersWithDetailsFromCSV();
    } catch (error) {
      console.error("Failed to fetch player details from CSV:", error);
    }

    const playerDetailsMap = new Map(
      allPlayerDetails.map(p => [p.name.toLowerCase().trim(), p])
    );

    const records = [[
      'Roster Name',
      'Clan Rank',
      'Player Name',
      'Town Hall',
      'CWL League',
      'War Hit Rate (3★)',
      'Total CWL Stars',
      'Avg Stars',
      'Total Attacks',
      'Defense Avg Stars',
      'Destruction %',
      'Missed Attacks',
      'Combined Heroes',
      'Discord',
      'Player Tag'
    ]];

    for (const roster of queryResult.Items) {
      const rosterName = roster.clanName || 'Unknown';
      const clanRank = roster.clanRank || 'N/A';

      if (!roster.players || roster.players.length === 0) {
        records.push([
          rosterName,
          clanRank,
          'No players',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
        continue;
      }

      console.log(`Processing roster: ${rosterName} with ${roster.players.length} players`);

      const batchSize = 25;
      const delayBetweenBatches = 1000;

      for (let i = 0; i < roster.players.length; i += batchSize) {
        const batch = roster.players.slice(i, i + batchSize);

        const batchResults = await Promise.all(
          batch.map(async (player: { playerName: string }) => {
            const details = playerDetailsMap.get(player.playerName.toLowerCase().trim());
            
            let cwlLeague = 'No Tag';
            let warHitRate = 'N/A';

            if (details?.playerTag && details.playerTag.trim()) {
              try {
                const [cwlLeagueData, hitRateData] = await Promise.all([
                  getPlayerCWLLeague(details.playerTag),
                  getPlayerWarHitRate(details.playerTag)
                ]);

                cwlLeague = cwlLeagueData;
                warHitRate = hitRateData
                  ? `${hitRateData.threeStars}/${hitRateData.totalAttacks} (${hitRateData.hitRate}%)`
                  : 'N/A';
              } catch (error) {
                console.error(`Failed to fetch data for ${player.playerName}:`, error);
                cwlLeague = 'Unknown';
                warHitRate = 'N/A';
              }
            }

            return {
              playerName: player.playerName,
              townHall: details?.townHall || '',
              cwlLeague,
              warHitRate,
              totalCwlStars: details?.totalCwlStars || '',
              avgStars: details?.avgStars || '',
              totalAttacks: details?.totalAttacks || '',
              defenseAvgStars: details?.defenseAvgStars || '',
              destruction: details?.destruction || '',
              missed: details?.missed || '',
              combinedHeroes: details?.combinedHeroes || '',
              discord: details?.discord || '',
              playerTag: details?.playerTag || ''
            };
          })
        );

        for (const playerData of batchResults) {
          records.push([
            rosterName,
            clanRank,
            playerData.playerName,
            playerData.townHall,
            playerData.cwlLeague,
            playerData.warHitRate,
            playerData.totalCwlStars,
            playerData.avgStars,
            playerData.totalAttacks,
            playerData.defenseAvgStars,
            playerData.destruction,
            playerData.missed,
            playerData.combinedHeroes,
            playerData.discord,
            playerData.playerTag
          ]);
        }

        if (i + batchSize < roster.players.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }

    console.log(`Generated CSV with ${records.length - 1} data rows`);

    const csv = stringify(records);
    const blob = new Blob([csv], { type: 'text/csv' });

    const formData = new FormData();
    formData.append('content', `📊 **Roster Export**\n\nExported ${queryResult.Items.length} roster(s) with detailed player stats.\nYou can upload this CSV to Google Sheets.`);
    formData.append('files[0]', blob, 'rosters-export.csv');

    await updateResponseWithAttachment(interaction.application_id, interaction.token, formData);
    
    console.log("Export completed successfully");
  } catch (error) {
    console.error("Error exporting rosters:", error);
    throw error;
  }
};
