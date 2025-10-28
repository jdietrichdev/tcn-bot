import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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
    const rosterName = rosterNameOption.value;
    const guildId = interaction.guild_id!;

    // Get the roster
    const rosterResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `roster#${rosterName}`,
        },
      })
    );

    if (!rosterResult.Item) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Roster \`${rosterName}\` not found.`,
      });
      return;
    }

    const roster = rosterResult.Item;
    const players = roster.players || [];

    // Check if player is already in the roster
    if (players.some((p: any) => p.playerName === playerName)) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Player **${playerName}** is already in the roster **${roster.clanName}**.`,
      });
      return;
    }

    // Add player to roster
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
          sk: `roster#${rosterName}`,
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
