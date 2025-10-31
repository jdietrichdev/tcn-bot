import { 
  APIMessageComponentInteraction, 
  APIEmbed,
  InteractionResponseType,
  MessageFlags
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateMessage } from '../adapters/discord-adapter';

export const handleSubsApproval = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const customId = interaction.data.custom_id;
    const guildId = interaction.guild_id;
    
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ This can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const parts = customId.split('_');
    const action = parts[1];
    const subId = parts.slice(2).join('_');

    const result = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: `subs#${guildId}`,
          sk: `request#${subId}`,
        },
      })
    );

    if (!result.Item) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ Substitution request not found.',
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const subData = result.Item;

    if (subData.status !== 'pending') {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `❌ This substitution request has already been ${subData.status}.`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const approvedBy = interaction.member?.user?.id || 'Unknown';

    if (action === 'approve') {
      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: `subs#${guildId}`,
            sk: `request#${subId}`,
          },
          UpdateExpression: 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'approved',
            ':approvedBy': approvedBy,
            ':approvedAt': new Date().toISOString(),
          },
        })
      );

      const updatedEmbed: APIEmbed = {
        title: '✅ Substitution Approved',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Approved by:** <@${approvedBy}>`,
        fields: [
          {
            name: '📤 Players Going Out',
            value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: '📥 Players Coming In',
            value: subData.inPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0x00FF00,
        footer: {
          text: `Sub ID: ${subId}`,
        },
        timestamp: new Date().toISOString(),
      };

      await updateMessage(
        interaction.channel.id,
        interaction.message.id,
        {
          embeds: [updatedEmbed],
          components: [],
        }
      );

      const notificationEmbed: APIEmbed = {
        title: '🔄 Player Substitution Notification',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Approved by:** <@${approvedBy}>`,
        fields: [
          {
            name: '📤 Players Going Out',
            value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: '📥 Players Coming In',
            value: subData.inPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0x5865F2,
        timestamp: new Date().toISOString(),
      };

      const discordBotToken = process.env.DISCORD_BOT_TOKEN;

      for (const channelId of subData.notificationChannelIds) {
        try {
          const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
          await fetch(discordApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${discordBotToken}`,
            },
            body: JSON.stringify({
              embeds: [notificationEmbed],
            }),
          });
        } catch (error) {
          console.error(`Failed to send notification to channel ${channelId}:`, error);
        }
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `✅ Substitution approved! Notifications sent to ${subData.notificationChannelIds.length} channel(s).`,
          flags: MessageFlags.Ephemeral,
        },
      };

    } else if (action === 'deny') {
      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: `subs#${guildId}`,
            sk: `request#${subId}`,
          },
          UpdateExpression: 'SET #status = :status, deniedBy = :deniedBy, deniedAt = :deniedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'denied',
            ':deniedBy': approvedBy,
            ':deniedAt': new Date().toISOString(),
          },
        })
      );

      const updatedEmbed: APIEmbed = {
        title: '❌ Substitution Denied',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Denied by:** <@${approvedBy}>`,
        fields: [
          {
            name: '📤 Players Going Out',
            value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: '📥 Players Coming In',
            value: subData.inPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0xFF0000,
        footer: {
          text: `Sub ID: ${subId}`,
        },
        timestamp: new Date().toISOString(),
      };

      await updateMessage(
        interaction.channel.id,
        interaction.message.id,
        {
          embeds: [updatedEmbed],
          components: [],
        }
      );

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ Substitution denied.',
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ Unknown action.',
        flags: MessageFlags.Ephemeral,
      },
    };

  } catch (error) {
    console.error('Error in handleSubsApproval:', error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ An error occurred while processing the approval.',
        flags: MessageFlags.Ephemeral,
      },
    };
  }
};
