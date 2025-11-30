import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { stringify } from "csv-stringify/sync";
import { updateResponseWithAttachment } from "../adapters/discord-adapter";
import { fetchPlayersWithDetailsFromCSV, PlayerData } from "../util/fetchUnrosteredPlayersCSV";
import { getPlayerNotes } from "../util/playerNotes";
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
    // Add a separator row after each roster
    records.push(["---- End of Roster ----", ...Array(records[0].length - 1).fill("")]);

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
      '@',
      'Player Name',
      'Player Tag',
      'Current Clan',
      'Discord',
      'TH',
      'Combined',
      'War Hitrate',
      'CWL Hitrate',
      'Last CWL',
      'Notes',
      'Total Attacks',
      'Stars',
      'Avg. Stars',
      'Destruction',
      'Avg. Destruction',
      '3 Stars',
      '2 Stars',
      '1 Star',
      '0 Stars',
      'Missed',
      'Defense Stars',
      'Defense Avg. Stars',
      'Defense Destruction',
      'Defense Avg. Destruction'
    ];

    for (const roster of queryResult.Items) {
      const rosterName = roster.clanName || 'Unknown';
      const clanRank = roster.clanRank || 'N/A';

      if (!roster.players || roster.players.length === 0) {
        records.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
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
            let warHitrate = '';
            let cwlHitrate = '';
            let avgDestruction = '';
            let threeStars = '';
            let twoStars = '';
            let oneStar = '';
            let zeroStars = '';
            let defenseDestruction = '';
            let defenseAvgDestruction = '';
            let notes = '';
            if (details?.playerTag && details.playerTag.trim()) {
              try {
                const [cwlLeagueData, hitRateData] = await Promise.all([
                  getPlayerCWLLeague(details.playerTag),
                  getPlayerWarHitRate(details.playerTag)
                ]);
                cwlLeague = cwlLeagueData;
                if (hitRateData) {
                  warHitrate = `${hitRateData.threeStars}/${hitRateData.totalAttacks} (${hitRateData.hitRate}%)`;
                  cwlHitrate = hitRateData.hitRate ? `${hitRateData.hitRate}%` : '';
                  threeStars = hitRateData.threeStars?.toString() || '';
                  // For demo, set other star breakdowns to blank
                  twoStars = '';
                  oneStar = '';
                  zeroStars = '';
                }
              } catch (error) {
                console.error(`Failed to fetch data for ${player.playerName}:`, error);
                cwlLeague = 'Unknown';
                warHitrate = '';
                cwlHitrate = '';
              }
            }
            // Notes from CWL responses
            notes = await getPlayerNotes(details?.discord || '', player.playerName);
            // Defensive stats (for demo, use blank or details if available)
            avgDestruction = details?.avgDestruction || '';
            defenseDestruction = details?.defenseDestruction || '';
            defenseAvgDestruction = details?.defenseAvgDestruction || '';
            return {
              playerName: player.playerName,
              playerTag: details?.playerTag || '',
              currentClan: rosterName, // fallback to roster name
              discord: details?.discord || '',
              townHall: details?.townHall || '',
              combinedHeroes: details?.combinedHeroes || '',
              warHitrate,
              cwlHitrate,
              lastCWL: '', // not available
              notes,
              totalAttacks: details?.totalAttacks || '',
              stars: details?.totalCwlStars || '', // fallback to totalCwlStars
              avgStars: details?.avgStars || '',
              destruction: details?.destruction || '',
              avgDestruction: details?.destruction || '', // fallback to destruction
              threeStars,
              twoStars,
              oneStar,
              zeroStars,
              missed: details?.missed || '',
              defenseStars: '', // not available
              defenseAvgStars: details?.defenseAvgStars || '',
              defenseDestruction: details?.destruction || '', // fallback to destruction
              defenseAvgDestruction: details?.destruction || '', // fallback to destruction
            };
          })
        );

        for (const playerData of batchResults) {
          records.push([
            playerData.discord ? `@${playerData.discord}` : '',
            playerData.playerName,
            playerData.playerTag,
            playerData.currentClan || rosterName,
            playerData.discord,
            playerData.townHall,
            playerData.combinedHeroes,
            playerData.warHitrate,
            playerData.cwlHitrate,
            playerData.lastCWL,
            playerData.notes,
            playerData.totalAttacks,
            playerData.stars,
            playerData.avgStars,
            playerData.destruction,
            playerData.avgDestruction,
            playerData.threeStars,
            playerData.twoStars,
            playerData.oneStar,
            playerData.zeroStars,
            playerData.missed,
            playerData.defenseStars,
            playerData.defenseAvgStars,
            playerData.defenseDestruction,
            playerData.defenseAvgDestruction
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
