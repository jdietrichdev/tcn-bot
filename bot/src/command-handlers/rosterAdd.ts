import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fetchUnrosteredPlayersFromCSV } from '../util/fetchUnrosteredPlayersCSV';

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
      if (r.sk === roster.sk) return false; // Skip current roster
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
  } catch (err) {
    console.error('Failed to add player to roster:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to add player to roster. Please try again or contact an admin.',
    });
  }
};
