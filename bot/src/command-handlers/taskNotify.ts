import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskNotify = async (
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
    const notifiedBy = interaction.member?.user?.id || interaction.user?.id;
    const notifierUsername = interaction.member?.user?.username || interaction.user?.username;

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

    if (task.status === 'approved') {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This task has already been approved and completed. No notification needed.',
      });
      return;
    }

    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': guildId,
          ':sk': 'task#',
        },
      })
    );

    const allTasks = queryResult.Items || [];
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const highPriorityPending = allTasks.filter(t => t.status === 'pending' && t.priority === 'high').length;

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'approved';

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const statusEmoji = {
      pending: '🟡',
      claimed: '🔵',
      completed: '🟢',
      approved: '✅'
    };

    let notificationType = '';
    let urgencyLevel = '';
    let color = 0x5865F2;

    if (isOverdue) {
      notificationType = '⏰ OVERDUE TASK ALERT';
      urgencyLevel = '🚨 **URGENT ATTENTION NEEDED**';
      color = 0xff0000;
    } else if (task.priority === 'high' && task.status === 'pending') {
      notificationType = '🔥 HIGH PRIORITY TASK';
      urgencyLevel = '⚡ **HIGH PRIORITY - NEEDS CLAIMING**';
      color = 0xff8c00;
    } else if (task.status === 'completed') {
      notificationType = '✅ TASK COMPLETED - AWAITING APPROVAL';
      urgencyLevel = '👀 **ADMIN REVIEW NEEDED**';
      color = 0x00ff00;
    } else {
      notificationType = '📢 TASK NOTIFICATION';
      urgencyLevel = '📋 **NEEDS ATTENTION**';
    }

    let pingText = '';
    if (task.assignedRole) {
      pingText = `<@&${task.assignedRole}> `;
    } else if (task.status === 'completed') {
      pingText = '**@admin** ';
    }

    const embed: APIEmbed = {
      title: notificationType,
      description: [
        urgencyLevel,
        '',
        `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.title}`,
        '',
        task.description || '*No description provided*',
      ].join('\n'),
      fields: [
        {
          name: '📊 Task Details',
          value: [
            `**Status:** ${statusEmoji[task.status as keyof typeof statusEmoji]} ${task.status.toUpperCase()}`,
            `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.priority.toUpperCase()}`,
            `**Assigned to:** ${task.assignedRole ? `<@&${task.assignedRole}>` : 'Anyone'}`,
            `**Due Date:** ${task.dueDate ? `📅 ${task.dueDate}${isOverdue ? ' ⏰ **OVERDUE**' : ''}` : '*No due date*'}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '📈 Current Status',
          value: [
            `**Total Pending:** ${pendingTasks} tasks`,
            `**High Priority Pending:** ${highPriorityPending} tasks`,
            '',
            task.status === 'claimed' ? `**Currently claimed by:** <@${task.claimedBy}>` : '',
            task.status === 'completed' ? `**Completed by:** <@${task.completedBy}>` : '',
          ].filter(Boolean).join('\n'),
          inline: true
        },
        {
          name: '🎯 Required Actions',
          value: task.status === 'pending' 
            ? '• Use `/task-claim` to claim this task\n• Work on the task requirements\n• Use `/task-complete` when finished'
            : task.status === 'claimed'
            ? '• Task is currently being worked on\n• Use `/task-complete` when finished'
            : task.status === 'completed'
            ? '• **ADMIN:** Use `/task-approve` to approve\n• **ADMIN:** Use `/task-delete` if rejected'
            : '• Task has been completed and approved',
          inline: false
        }
      ],
      color,
      footer: {
        text: `Task ID: ${taskId} • Notified by ${notifierUsername}`,
      },
      timestamp: new Date().toISOString()
    };

    let actionButtons = [];
    
    if (task.status === 'pending') {
      actionButtons = [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_claim_${taskId}`,
          label: 'Claim Task',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '✋' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_pending',
          label: 'View All Pending',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '📋' }
        }
      ];
    } else if (task.status === 'completed') {
      actionButtons = [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_approve_${taskId}`,
          label: 'Approve Task',
          style: ButtonStyle.Success as ButtonStyle.Success,
          emoji: { name: '✅' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_completed',
          label: 'View Completed',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '📋' }
        }
      ];
    } else {
      actionButtons = [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_all',
          label: 'View All Tasks',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '📋' }
        }
      ];
    }

    actionButtons.push({
      type: ComponentType.Button as ComponentType.Button,
      label: 'Open Dashboard',
      style: ButtonStyle.Link as ButtonStyle.Link,
      url: `${process.env.DASHBOARD_URL || 'https://tcn-bot.vercel.app'}/tasks?guild=${guildId}`
    } as any);

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: actionButtons
    }];

    const content = pingText ? `${pingText}${notificationType}` : undefined;

    await updateResponse(interaction.application_id, interaction.token, {
      content,
      embeds: [embed],
      components
    });

    console.log(`Task ${taskId} notification sent by ${notifierUsername} (${notifiedBy})`);

  } catch (err) {
    console.error('Failed to send task notification:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to send task notification. Please try again or contact an admin.',
    });
  }
};