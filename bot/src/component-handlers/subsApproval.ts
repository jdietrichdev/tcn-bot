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
    
    if (!guildId) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
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

    if (action === 'approve') {
      approvals[currentChannelId] = {
        approvedBy,
        approvedAt: new Date().toISOString(),
      };

      const allApproved = subData.approvalChannelIds.every((channelId: string) => 
        approvals[channelId] !== undefined
      );

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
      const totalApprovals = subData.approvalChannelIds.length;

      const updatedEmbed: APIEmbed = {
        title: allApproved ? '✅ Substitution Fully Approved' : '⏳ Substitution Partially Approved',
        description: `**Requested by:** <@${subData.requestedBy}>\n**Approvals:** ${approvalCount}/${totalApprovals}`,
        fields: [
          {
            name: `📤 Players Leaving ${subData.outClan}`,
            value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining ${subData.inClan}`,
            value: subData.inPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
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
        const notificationEmbed: APIEmbed = {
          title: '🔄 Player Substitution Notification',
          description: `**Requested by:** <@${subData.requestedBy}>`,
          fields: [
            {
              name: `📤 Players Leaving ${subData.outClan}`,
              value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
            {
              name: `📥 Players Joining ${subData.inClan}`,
              value: subData.inPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
              inline: true,
            },
          ],
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        };

        const discordBotToken = process.env.BOT_TOKEN;

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

        await updateResponse(interaction.application_id, interaction.token, {
          content: `✅ All approvals received! Notifications sent to ${subData.notificationChannelIds.length} channel(s).`,
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
        fields: [
          {
            name: `📤 Players Leaving ${subData.outClan}`,
            value: subData.outPlayerIds.map((id: string) => `<@${id}>`).join('\n'),
            inline: true,
          },
          {
            name: `📥 Players Joining ${subData.inClan}`,
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

      const discordBotToken = process.env.BOT_TOKEN;

      for (const channelId of subData.approvalChannelIds) {
        if (channelId === currentChannelId) continue;
        
        try {
          const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
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
                  embeds: [updatedEmbed],
                  components: [],
                }),
              });
            }
          }
        } catch (error) {
          console.error(`Failed to update message in channel ${channelId}:`, error);
        }
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
      content: '❌ An error occurred while processing the approval.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
