import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export const handleRegisterSubsCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = interaction.guild_id;
    if (!guildId) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    const outPlayersOption = interaction.data.options?.find(
      (opt) => opt.name === 'out-players'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const outClanOption = interaction.data.options?.find(
      (opt) => opt.name === 'out-clan'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const inPlayersOption = interaction.data.options?.find(
      (opt) => opt.name === 'in-players'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const inClanOption = interaction.data.options?.find(
      (opt) => opt.name === 'in-clan'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const approvalChannelsOption = interaction.data.options?.find(
      (opt) => opt.name === 'approval-channels'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const notificationChannelsOption = interaction.data.options?.find(
      (opt) => opt.name === 'notification-channels'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!outPlayersOption || !outClanOption || !inPlayersOption || !inClanOption || !approvalChannelsOption || !notificationChannelsOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Missing required parameters.',
      });
      return;
    }

    const outPlayers = outPlayersOption.value;
    const outClan = outClanOption.value;
    const inPlayers = inPlayersOption.value;
    const inClan = inClanOption.value;
    const approvalChannels = approvalChannelsOption.value;
    const notificationChannels = notificationChannelsOption.value;
    
    const outUserIds = extractUserIds(outPlayers);
    const inUserIds = extractUserIds(inPlayers);
    const approvalChannelIds = extractChannelIds(approvalChannels);
    const notificationChannelIds = extractChannelIds(notificationChannels);

    if (outUserIds.length === 0 || inUserIds.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Please mention at least one user for both out-players and in-players using @username format.',
      });
      return;
    }

    if (approvalChannelIds.length === 0 || notificationChannelIds.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Please mention at least one channel for both approval-channels and notification-channels using #channel format.',
      });
      return;
    }

    const subId = uuidv4();
    const requestedBy = interaction.member?.user?.id || 'Unknown';

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: `subs#${guildId}`,
          sk: `request#${subId}`,
          outPlayerIds: outUserIds,
          outClan,
          inPlayerIds: inUserIds,
          inClan,
          approvalChannelIds,
          notificationChannelIds,
          requestedBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })
    );

    const approvalEmbed: APIEmbed = {
      title: '🔄 Substitution Request',
      description: `**Requested by:** <@${requestedBy}>`,
      fields: [
        {
          name: `📤 Players Leaving ${outClan}`,
          value: outUserIds.map(id => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: `📥 Players Joining ${inClan}`,
          value: inUserIds.map(id => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: '📢 Notification Channels',
          value: notificationChannelIds.map((id: string) => `<#${id}>`).join(', '),
          inline: false,
        },
      ],
      color: 0x5865F2,
      footer: {
        text: `Sub ID: ${subId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const approvalMessage = {
      embeds: [approvalEmbed],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              custom_id: `approve_sub_${subId}`,
              label: 'Approve',
              style: ButtonStyle.Success,
              emoji: { name: '✅' },
            },
            {
              type: ComponentType.Button,
              custom_id: `deny_sub_${subId}`,
              label: 'Deny',
              style: ButtonStyle.Danger,
              emoji: { name: '❌' },
            },
          ],
        },
      ],
    };

    const discordBotToken = process.env.BOT_TOKEN;

    if (!discordBotToken) {
      console.error('BOT_TOKEN environment variable is not set');
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Bot token is not configured.',
      });
      return;
    }

    let successCount = 0;
    for (const approvalChannelId of approvalChannelIds) {
      try {
        console.log(`Attempting to send approval message to channel: ${approvalChannelId}`);
        const discordApiUrl = `https://discord.com/api/v10/channels/${approvalChannelId}/messages`;

        const response = await fetch(discordApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
          body: JSON.stringify(approvalMessage),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send approval message to channel ${approvalChannelId}:`, errorText);
        } else {
          successCount++;
          const responseData = await response.json();
          console.log(`Successfully sent approval message to channel ${approvalChannelId}, message ID: ${responseData.id}`);
        }
      } catch (error) {
        console.error(`Error sending to approval channel ${approvalChannelId}:`, error);
      }
    }

    if (successCount === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Failed to send approval messages to any channels. Please check the channel IDs and bot permissions.',
      });
      return;
    }

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: `subs#${guildId}`,
          sk: `request#${subId}`,
          outPlayerIds: outUserIds,
          outClan,
          inPlayerIds: inUserIds,
          inClan,
          approvalChannelIds,
          notificationChannelIds,
          requestedBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Substitution request submitted! Approval messages sent to ${approvalChannelIds.length} channel(s): ${approvalChannelIds.map((id: string) => `<#${id}>`).join(', ')}`,
    });

  } catch (error) {
    console.error('Error in handleRegisterSubsCommand:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ An error occurred while processing the substitution request.',
    });
  }
};

function extractUserIds(input: string): string[] {
  const mentionRegex = /<@!?(\d+)>/g;
  const matches = [...input.matchAll(mentionRegex)];
  return matches.map(match => match[1]);
}

function extractChannelIds(input: string): string[] {
  const channelRegex = /<#(\d+)>/g;
  const matches = [...input.matchAll(channelRegex)];
  return matches.map(match => match[1]);
}
