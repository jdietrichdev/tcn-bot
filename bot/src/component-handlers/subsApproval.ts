import { 
  APIMessageComponentInteraction, 
  APIEmbed,
  MessageFlags
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateMessage, updateResponse } from '../adapters/discord-adapter';

export const handleSubsApproval = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const customId = interaction.data.custom_id;
    const guildId = interaction.guild_id;
    
    console.log(`[handleSubsApproval] Called with custom_id: ${customId}, guildId: ${guildId}`);
    
    if (!guildId) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const parts = customId.split('_');
    const action = parts[0];
    const subId = parts.slice(2).join('_');
    
    console.log(`[handleSubsApproval] Parsed - action: ${action}, subId: ${subId}`);

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
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Substitution request not found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subData = result.Item;
    const currentChannelId = interaction.channel.id;

    if (subData.status !== 'pending') {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ This substitution request has already been ${subData.status}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const approvedBy = interaction.member?.user?.id || 'Unknown';
    
    const approvals = subData.approvals || {};
    const denials = subData.denials || {};

    const isClanOutChannel = currentChannelId === subData.clanOutApprovalChannelId;
    const isClanInChannel = currentChannelId === subData.clanInApprovalChannelId;

    if (action === 'approve') {
      approvals[currentChannelId] = {
        approvedBy,
        approvedAt: new Date().toISOString(),
      };

      const clanOutApproved = approvals[subData.clanOutApprovalChannelId] !== undefined;
      const clanInApproved = approvals[subData.clanInApprovalChannelId] !== undefined;
      const allApproved = clanOutApproved && clanInApproved;

      const updateExpression = allApproved
        ? 'SET #status = :status, approvals = :approvals, allApprovedAt = :allApprovedAt'
        : 'SET approvals = :approvals';
      
      const expressionAttributeValues: any = {
        ':approvals': approvals,
      };

      if (allApproved) {
        expressionAttributeValues[':status'] = 'approved';
        expressionAttributeValues[':allApprovedAt'] = new Date().toISOString();
      }

      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: `subs#${guildId}`,
            sk: `request#${subId}`,
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: allApproved ? {
            '#status': 'status',
          } : undefined,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );

      const approvalCount = Object.keys(approvals).length;
      const totalApprovals = 2;

      const updatedEmbed: APIEmbed = isClanOutChannel ? {
        title: allApproved ? '✅ Substitution Fully Approved' : '⏳ Substitution Partially Approved',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Approvals:** ${approvalCount}/${totalApprovals}`,
        fields: [
          {
            name: `📤 Players Leaving ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining from ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0x5865F2,
        footer: {
          text: `Sub ID: ${subId}`,
        },
        timestamp: new Date().toISOString(),
      } : {
        title: allApproved ? '✅ Substitution Fully Approved' : '⏳ Substitution Partially Approved',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Approvals:** ${approvalCount}/${totalApprovals}`,
        fields: [
          {
            name: `📤 Players Leaving to ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0x5865F2,
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
          components: allApproved ? [] : interaction.message.components,
        }
      );

      if (allApproved) {
        const clanOutNotificationEmbed: APIEmbed = {
          title: '🔄 Player Substitution Notification',
          fields: [
            {
              name: `📤 Players Leaving ${subData.clanOutName}`,
              value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
            {
              name: `📥 Players Joining from ${subData.clanInName}`,
              value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
          ],
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        };

        const clanInNotificationEmbed: APIEmbed = {
          title: '🔄 Player Substitution Notification',
          fields: [
            {
              name: `📤 Players Leaving to ${subData.clanOutName}`,
              value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
            {
              name: `📥 Players Joining ${subData.clanInName}`,
              value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
          ],
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        };

        const discordBotToken = process.env.BOT_TOKEN;

        try {
          const discordApiUrl = `https://discord.com/api/v10/channels/${subData.clanOutNotificationChannelId}/messages`;
          await fetch(discordApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${discordBotToken}`,
            },
            body: JSON.stringify({
              embeds: [clanOutNotificationEmbed],
            }),
          });
        } catch (error) {
          console.error(`Failed to send notification to ${subData.clanOutName} channel ${subData.clanOutNotificationChannelId}:`, error);
        }

        try {
          const discordApiUrl = `https://discord.com/api/v10/channels/${subData.clanInNotificationChannelId}/messages`;
          await fetch(discordApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${discordBotToken}`,
            },
            body: JSON.stringify({
              embeds: [clanInNotificationEmbed],
            }),
          });
        } catch (error) {
          console.error(`Failed to send notification to ${subData.clanInName} channel ${subData.clanInNotificationChannelId}:`, error);
        }

        await updateResponse(interaction.application_id, interaction.token, {
          content: `✅ All approvals received! Notifications sent to both clans.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await updateResponse(interaction.application_id, interaction.token, {
        content: `✅ Approval recorded. ${approvalCount}/${totalApprovals} approvals received.`,
        flags: MessageFlags.Ephemeral,
      });
      return;

    } else if (action === 'deny') {
      denials[currentChannelId] = {
        deniedBy: approvedBy,
        deniedAt: new Date().toISOString(),
      };

      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: `subs#${guildId}`,
            sk: `request#${subId}`,
          },
          UpdateExpression: 'SET #status = :status, denials = :denials',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'denied',
            ':denials': denials,
          },
        })
      );

      const updatedEmbed: APIEmbed = {
        title: '❌ Substitution Denied',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Denied by:** <@${approvedBy}>`,
        fields: isClanOutChannel ? [
          {
            name: `📤 Players Leaving ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining from ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ] : [
          {
            name: `📤 Players Leaving to ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0xFF0000,
        footer: {
          text: `Sub ID: ${subId}`,
        },
        timestamp: new Date().toISOString(),
      };

      const discordBotToken = process.env.BOT_TOKEN;

      const otherChannelId = isClanOutChannel ? subData.clanInApprovalChannelId : subData.clanOutApprovalChannelId;
      const otherEmbed: APIEmbed = {
        title: '❌ Substitution Denied',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Denied by:** <@${approvedBy}>`,
        fields: isClanOutChannel ? [
          {
            name: `📤 Players Leaving to ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ] : [
          {
            name: `📤 Players Leaving ${subData.clanOutName}`,
            value: subData.clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining from ${subData.clanInName}`,
            value: subData.clanInIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
        ],
        color: 0xFF0000,
        footer: {
          text: `Sub ID: ${subId}`,
        },
        timestamp: new Date().toISOString(),
      };

      try {
        const discordApiUrl = `https://discord.com/api/v10/channels/${otherChannelId}/messages`;
        const messagesResponse = await fetch(`${discordApiUrl}?limit=50`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
        });

        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          const subMessage = messages.find((msg: any) => 
            msg.embeds?.[0]?.footer?.text === `Sub ID: ${subId}` && 
            msg.components?.length > 0
          );

          if (subMessage) {
            await fetch(`${discordApiUrl}/${subMessage.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bot ${discordBotToken}`,
              },
              body: JSON.stringify({
                embeds: [otherEmbed],
                components: [],
              }),
            });
          }
        }
      } catch (error) {
        console.error(`Failed to update message in channel ${otherChannelId}:`, error);
      }

      await updateMessage(
        interaction.channel.id,
        interaction.message.id,
        {
          embeds: [updatedEmbed],
          components: [],
        }
      );

      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Substitution denied.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Unknown action.',
      flags: MessageFlags.Ephemeral,
    });

  } catch (error) {
    console.error('Error in handleSubsApproval:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `❌ An error occurred while processing the approval. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Custom ID: ${interaction.data.custom_id}`,
      flags: MessageFlags.Ephemeral,
    });
  }
};
