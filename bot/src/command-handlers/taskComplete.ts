import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskComplete = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (opt) => opt.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const notesOption = interaction.data.options?.find(
      (opt) => opt.name === 'notes'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!taskOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task selection is required.',
      });
      return;
    }

    const taskId = taskOption.value;
    const notes = notesOption?.value;
    const guildId = interaction.guild_id!;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;

    const getResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    const task = getResult.Item;
    if (!task) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task not found. It may have been deleted.',
      });
      return;
    }

    if (task.claimedBy !== userId) {
      if (task.status === 'pending') {
        await updateResponse(interaction.application_id, interaction.token, {
          content: '❌ You cannot complete a task that you haven\'t claimed. Use `/task-claim` first.',
        });
        return;
      } else if (task.claimedBy) {
        await updateResponse(interaction.application_id, interaction.token, {
          content: `❌ This task is claimed by <@${task.claimedBy}>. Only they can mark it as complete.`,
        });
        return;
      }
    }

    if (task.status !== 'claimed') {
      const statusMessages = {
        pending: '❌ This task needs to be claimed before it can be completed.',
        completed: '❌ This task has already been marked as completed.',
        approved: '❌ This task has already been completed and approved.',
      };
      
      await updateResponse(interaction.application_id, interaction.token, {
        content: statusMessages[task.status as keyof typeof statusMessages] || '❌ This task cannot be completed.',
      });
      return;
    }

    const now = new Date().toISOString();
    const updateParams: any = {
      TableName: 'BotTable',
      Key: {
        pk: guildId,
        sk: `task#${taskId}`,
      },
      UpdateExpression: 'SET #status = :status, completedBy = :completedBy, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':completedBy': userId,
        ':completedAt': now,
      },
    };

    if (notes) {
      updateParams.UpdateExpression += ', completionNotes = :notes';
      updateParams.ExpressionAttributeValues[':notes'] = notes;
    }

    await dynamoDbClient.send(new UpdateCommand(updateParams));

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const embed: APIEmbed = {
      title: '🎉 ╔═ TASK COMPLETED ═╗ 🏆',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
                  `> ${task.description || '*No description provided*'}`,
      fields: [
        {
          name: '📝 **Completion Notes**',
          value: notes ? `\`\`\`\n${notes}\n\`\`\`` : '`No additional notes provided`',
          inline: false
        },
        {
          name: '👤 **Completed By**',
          value: `<@${userId}>`,
          inline: true
        },
        {
          name: '⏰ **Completed At**',
          value: `<t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '📋 **Status**',
          value: '`✅ AWAITING APPROVAL`',
          inline: true
        },
        {
          name: '⚡ **What\'s Next?**',
          value: '```\n• Task is ready for admin review\n• Will be removed from board once approved\n• Check dashboard for approval status\n```',
          inline: false
        }
      ],
      color: 0x00ff00,
      footer: {
        text: `Task Management System • Pending approval`,
      },
      timestamp: now
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_completed',
          label: 'View Completed Tasks',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '📋' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_my',
          label: 'My Tasks',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '👤' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          label: 'Open Dashboard',
          style: ButtonStyle.Link as ButtonStyle.Link,
          url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
        }
      ]
    }];

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components
    });

    console.log(`Task ${taskId} completed by ${username} (${userId})`);

  } catch (err) {
    console.error('Failed to complete task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to complete task. Please try again or contact an admin.',
    });
  }
};