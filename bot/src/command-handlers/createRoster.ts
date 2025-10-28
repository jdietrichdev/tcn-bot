import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption, APIApplicationCommandInteractionDataIntegerOption } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

export const handleCreateRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const clanNameOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-name'
    ) as APIApplicationCommandInteractionDataStringOption;
    const clanRankOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-rank'
    ) as APIApplicationCommandInteractionDataIntegerOption;

    if (!clanNameOption || !clanRankOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'Missing required parameters.',
      });
      return;
    }

    const clanName = clanNameOption.value;
    const clanRank = clanRankOption.value;
    const guildId = interaction.guild_id!;

    const rosterId = `cwl-roster-${Date.now()}`;
    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: guildId,
          sk: `roster#${rosterId}`,
          clanName,
          clanRank,
          players: [],
          createdAt: new Date().toISOString(),
          createdBy: interaction.member!.user.id,
        },
      })
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Roster created: **${clanName}** (Rank ${clanRank})\nRoster ID: \`${rosterId}\``,
    });
  } catch (err) {
    console.error('Failed to create roster:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to create roster. Please try again or contact an admin.',
    });
  }
};
