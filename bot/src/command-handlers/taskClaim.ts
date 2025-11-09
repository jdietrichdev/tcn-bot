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

export const handleTaskClaim = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (opt) => opt.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!taskOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task selection is required.',
      });
      return;
    }

    const taskId = taskOption.value;
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
        content: '❌ Task not found. It may have been deleted or completed.',
      });
      return;
    }

    const allowsMultipleClaims = (task.assignedRoleIds && task.assignedRoleIds.length > 0) || 
                                (task.assignedUserIds && task.assignedUserIds.length > 0) ||
                                task.assignedRole;
    
    if (!allowsMultipleClaims && task.status !== 'pending') {
      const statusMessages = {
        claimed: `❌ This task has already been claimed by <@${task.claimedBy}>.`,
        completed: `❌ This task has been completed by <@${task.completedBy}>.`,
        approved: '❌ This task has been completed and approved.',
      };
      
      await updateResponse(interaction.application_id, interaction.token, {
        content: statusMessages[task.status as keyof typeof statusMessages] || '❌ This task is no longer available.',
      });
      return;
    }

    let hasPermission = false;
    
    if (task.assignedRoleIds && Array.isArray(task.assignedRoleIds)) {
      const userRoles = interaction.member?.roles || [];
      hasPermission = task.assignedRoleIds.some(roleId => userRoles.includes(roleId));
    } else if (task.assignedRole) {
      const userRoles = interaction.member?.roles || [];
      hasPermission = userRoles.includes(task.assignedRole);
    }
    
    if (!hasPermission && task.assignedUserIds && Array.isArray(task.assignedUserIds)) {
      hasPermission = task.assignedUserIds.includes(userId);
    } else if (!hasPermission && task.assignedTo) {
      hasPermission = task.assignedTo === userId;
    }
    
    if ((task.assignedRoleIds || task.assignedUserIds || task.assignedRole || task.assignedTo) && !hasPermission) {
      const assignmentInfo = [];
      if (task.assignedRoleIds && task.assignedRoleIds.length > 0) {
        assignmentInfo.push(`Roles: ${task.assignedRoleIds.map((id: string) => `<@&${id}>`).join(', ')}`);
      }
      if (task.assignedUserIds && task.assignedUserIds.length > 0) {
        assignmentInfo.push(`Users: ${task.assignedUserIds.map((id: string) => `<@${id}>`).join(', ')}`);
      }
      
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ This task is restricted to: ${assignmentInfo.join(' | ')}. Only assigned members can claim this task.`,
      });
      return;
    }
    
    if (allowsMultipleClaims && task.claimedBy) {
      const claimedByArray = Array.isArray(task.claimedBy) ? task.claimedBy : [task.claimedBy];
      if (claimedByArray.includes(userId)) {
        await updateResponse(interaction.application_id, interaction.token, {
          content: '❌ You have already claimed this task.',
        });
        return;
      }
    }


    const now = new Date().toISOString();
    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET #status = :status, claimedBy = :claimedBy, claimedAt = :claimedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'claimed',
          ':claimedBy': userId,
          ':claimedAt': now,
        },
      })
    );

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const embed: APIEmbed = {
      title: '🚀 ✦ TASK CLAIMED ✦',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
                  `> ${task.description || '*No description provided*'}`,
      fields: [
        {
          name: '📊 **Task Information**',
          value: [
            `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} \`${task.priority.toUpperCase()}\``,
            `**Due Date:** ${task.dueDate ? `📅 \`${task.dueDate}\`` : '`No due date set`'}`
          ].join('\n'),
          inline: false
        },
        {
          name: '👤 **Claimed By**',
          value: `<@${userId}>`,
          inline: true
        },
        {
          name: '⏰ **Claimed At**',
          value: `<t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '📋 **Status**',
          value: '`🔄 IN PROGRESS`',
          inline: true
        },
        {
          name: '📝 **Next Steps**',
          value: '```\n• Work on the task requirements\n• Use /task-complete when finished\n• Add completion notes if needed\n```',
          inline: false
        }
      ],
      color: 0x0099ff,
      footer: {
        text: `Task Management System • Now in progress`,
      },
      timestamp: now
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_complete_${taskId}`,
          label: 'Mark Complete',
          style: ButtonStyle.Success as ButtonStyle.Success,
          emoji: { name: '✅' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_unclaim_${taskId}`,
          label: 'Unclaim Task',
          style: ButtonStyle.Danger as ButtonStyle.Danger,
          emoji: { name: '❌' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_my',
          label: 'My Tasks',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '📋' }
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

    console.log(`Task ${taskId} claimed by ${username} (${userId})`);

  } catch (err) {
    console.error('Failed to claim task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to claim task. Please try again or contact an admin.',
    });
  }
};