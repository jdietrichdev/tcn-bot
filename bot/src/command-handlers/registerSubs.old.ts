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

    const clan1OutOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan1-out'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan1InOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan1-in'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan1NameOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan1-name'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan2OutOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan2-out'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan2InOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan2-in'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan2NameOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan2-name'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan1ApprovalChannelOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan1-approval-channel'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan2ApprovalChannelOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan2-approval-channel'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan1NotificationChannelOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan1-notification-channel'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clan2NotificationChannelOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan2-notification-channel'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!clan1OutOption || !clan1InOption || !clan1NameOption || !clan2OutOption || !clan2InOption || !clan2NameOption || !clan1ApprovalChannelOption || !clan2ApprovalChannelOption || !clan1NotificationChannelOption || !clan2NotificationChannelOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Missing required parameters.',
      });
      return;
    }

    const clan1Out = clan1OutOption.value;
    const clan1In = clan1InOption.value;
    const clan1Name = clan1NameOption.value;
    const clan2Out = clan2OutOption.value;
    const clan2In = clan2InOption.value;
    const clan2Name = clan2NameOption.value;
    const clan1ApprovalChannel = clan1ApprovalChannelOption.value;
    const clan2ApprovalChannel = clan2ApprovalChannelOption.value;
    const clan1NotificationChannel = clan1NotificationChannelOption.value;
    const clan2NotificationChannel = clan2NotificationChannelOption.value;
    
    const clan1OutIds = extractUserIds(clan1Out);
    const clan1InIds = extractUserIds(clan1In);
    const clan2OutIds = extractUserIds(clan2Out);
    const clan2InIds = extractUserIds(clan2In);
    const clan1ApprovalChannelId = extractChannelIds(clan1ApprovalChannel)[0];
    const clan2ApprovalChannelId = extractChannelIds(clan2ApprovalChannel)[0];
    const clan1NotificationChannelId = extractChannelIds(clan1NotificationChannel)[0];
    const clan2NotificationChannelId = extractChannelIds(clan2NotificationChannel)[0];

    if (clan1OutIds.length === 0 || clan1InIds.length === 0 || clan2OutIds.length === 0 || clan2InIds.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Please mention at least one user for all player fields using @username format.',
      });
      return;
    }

    if (!clan1ApprovalChannelId || !clan2ApprovalChannelId || !clan1NotificationChannelId || !clan2NotificationChannelId) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Please mention valid channels using #channel format.',
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
          clan1OutIds,
          clan1InIds,
          clan1Name,
          clan2OutIds,
          clan2InIds,
          clan2Name,
          clan1ApprovalChannelId,
          clan2ApprovalChannelId,
          clan1NotificationChannelId,
          clan2NotificationChannelId,
          requestedBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })
    );

    const clan1ApprovalEmbed: APIEmbed = {
      title: '🔄 Substitution Request',
      description: `**Requested by:** <@${requestedBy}>`,
      fields: [
        {
          name: `📤 Players Leaving ${clan1Name}`,
          value: clan1OutIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: `📥 Players Joining ${clan1Name}`,
          value: clan1InIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: '📢 Notification Channel',
          value: `<#${clan1NotificationChannelId}>`,
          inline: false,
        },
      ],
      color: 0x5865F2,
      footer: {
        text: `Sub ID: ${subId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const clan2ApprovalEmbed: APIEmbed = {
      title: '🔄 Substitution Request',
      description: `**Requested by:** <@${requestedBy}>`,
      fields: [
        {
          name: `📤 Players Leaving ${clan2Name}`,
          value: clan2OutIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: `📥 Players Joining ${clan2Name}`,
          value: clan2InIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: '📢 Notification Channel',
          value: `<#${clan2NotificationChannelId}>`,
          inline: false,
        },
      ],
      color: 0x5865F2,
      footer: {
        text: `Sub ID: ${subId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const approvalMessage = (embed: APIEmbed) => ({
      embeds: [embed],
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
    });

    const discordBotToken = process.env.BOT_TOKEN;

    if (!discordBotToken) {
      console.error('BOT_TOKEN environment variable is not set');
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Bot token is not configured.',
      });
      return;
    }

    let successCount = 0;
    
    try {
      console.log(`Attempting to send approval message to clan 1 channel: ${clan1ApprovalChannelId}`);
      const clan1Response = await fetch(
        `https://discord.com/api/v10/channels/${clan1ApprovalChannelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
          body: JSON.stringify(approvalMessage(clan1ApprovalEmbed)),
        }
      );

      if (clan1Response.ok) {
        successCount++;
        console.log(`Successfully sent approval message to clan 1 channel`);
      } else {
        const errorText = await clan1Response.text();
        console.error(`Failed to send approval message to clan 1 channel:`, errorText);
      }
    } catch (error) {
      console.error(`Error sending to clan 1 approval channel:`, error);
    }

    try {
      console.log(`Attempting to send approval message to clan 2 channel: ${clan2ApprovalChannelId}`);
      const clan2Response = await fetch(
        `https://discord.com/api/v10/channels/${clan2ApprovalChannelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
          body: JSON.stringify(approvalMessage(clan2ApprovalEmbed)),
        }
      );

      if (clan2Response.ok) {
        successCount++;
        console.log(`Successfully sent approval message to clan 2 channel`);
      } else {
        const errorText = await clan2Response.text();
        console.error(`Failed to send approval message to clan 2 channel:`, errorText);
      }
    } catch (error) {
      console.error(`Error sending to clan 2 approval channel:`, error);
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
          clan1OutIds,
          clan1InIds,
          clan1Name,
          clan2OutIds,
          clan2InIds,
          clan2Name,
          clan1ApprovalChannelId,
          clan2ApprovalChannelId,
          clan1NotificationChannelId,
          clan2NotificationChannelId,
          requestedBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Substitution request submitted! Approval messages sent to both clans.`,
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
