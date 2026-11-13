import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handleCreateRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const clanNameOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-name'
    ) as APIApplicationCommandInteractionDataStringOption;
    const clanRankOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-rank'
    ) as APIApplicationCommandInteractionDataStringOption;
    const monthOption = interaction.data.options?.find(
      (opt) => opt.name === 'month'
    ) as APIApplicationCommandInteractionDataStringOption;
    const clanTagOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-tag'
    ) as APIApplicationCommandInteractionDataStringOption | undefined;

    if (!clanNameOption || !clanRankOption || !monthOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'Missing required parameters.',
      });
      return;
    }

    const clanName = clanNameOption.value.trim();
    const clanRank = clanRankOption.value;
    const month = monthOption.value;
    const clanTagInput = clanTagOption?.value.trim().toUpperCase();
    const guildId = interaction.guild_id;

    if (!clanTagInput || !/^#?[0289PYLQGRJCUV]{3,15}$/.test(clanTagInput)) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Enter a valid Clash of Clans clan tag.',
      });
    }

    const clanTag = clanTagInput.startsWith('#') ? clanTagInput : `#${clanTagInput}`;

    if (!guildId) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This command can only be used in a server.',
      });
    }

    const monthResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: { pk: guildId, sk: `cwl-month#${month}` },
      })
    );

    if (!monthResult.Item || monthResult.Item.status !== 'open') {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ CWL management is not open for **${month}**. Start it with \`/cwl-month-start\` first.`,
      });
    }

    const existingRosters = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': guildId,
          ':sk': 'roster#',
        },
      })
    );

    if (existingRosters.Items?.some(
      (roster) =>
        roster.cwlMonth === month &&
        (roster.clanTag?.toUpperCase() === clanTag ||
          roster.clanName?.toLowerCase() === clanName.toLowerCase())
    )) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ A roster for **${clanName}** already exists in **${month}**.`,
      });
    }

    const rosterId = `cwl-${month}-${clanTag.slice(1)}`;
    try {
      await dynamoDbClient.send(
        new PutCommand({
          TableName: 'BotTable',
          Item: {
            pk: guildId,
            sk: `roster#${rosterId}`,
            clanName,
            clanRank,
            cwlMonth: month,
            clanTag,
            players: [],
            createdAt: new Date().toISOString(),
            createdBy: interaction.member!.user.id,
          },
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return updateResponse(interaction.application_id, interaction.token, {
          content: `❌ A roster for **${clanName}** already exists in **${month}**.`,
        });
      }
      throw error;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Roster created: **${clanName}** (Rank ${clanRank}) for **${month}**${clanTag ? ` · Clan tag \`${clanTag}\`` : ''}\nRoster ID: \`${rosterId}\``,
    });
  } catch (err) {
    console.error('Failed to create roster:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failed to create roster. Please try again or contact an admin.',
    });
  }
};
