import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataRoleOption,
  APIApplicationCommandInteractionDataUserOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

function extractRoleIds(text: string): string[] {
  const mentions = text.match(/<@&(\d+)>/g);
  if (!mentions) return [];
  return mentions.map((mention) => {
    const match = mention.match(/\d+/);
    return match ? match[0] : '';
  }).filter(Boolean);
}

function extractUserIds(text: string): string[] {
  const mentions = text.match(/<@!?(\d+)>/g);
  if (!mentions) return [];
  return mentions.map((mention) => {
    const match = mention.match(/\d+/);
    return match ? match[0] : '';
  }).filter(Boolean);
}

export const handleTaskCreate = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const titleOption = interaction.data.options?.find(
      (opt) => opt.name === 'title'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const descriptionOption = interaction.data.options?.find(
      (opt) => opt.name === 'description'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const assignedRolesOption = interaction.data.options?.find(
      (opt) => opt.name === 'assigned-roles'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const assignUsersOption = interaction.data.options?.find(
      (opt) => opt.name === 'assign-users'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const priorityOption = interaction.data.options?.find(
      (opt) => opt.name === 'priority'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const dueDateOption = interaction.data.options?.find(
      (opt) => opt.name === 'due-date'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!titleOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task title is required.',
      });
      return;
    }

    const title = titleOption.value;
    const description = descriptionOption?.value || '';
    const assignedRoleIds = assignedRolesOption ? extractRoleIds(assignedRolesOption.value) : [];
    const assignedUserIds = assignUsersOption ? extractUserIds(assignUsersOption.value) : [];
    const priority = priorityOption?.value || 'medium';
    const dueDate = dueDateOption?.value;
    const guildId = interaction.guild_id!;
    const createdBy = interaction.member?.user?.id || interaction.user?.id;

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Due date must be in YYYY-MM-DD format (e.g., 2025-11-15).',
      });
      return;
    }

    const taskId = `task-${uuidv4()}`;
    const now = new Date().toISOString();

    
    const multipleClaimsAllowed = assignedRoleIds.length > 0 || assignedUserIds.length > 1;

    const shouldAutoAssign = assignedUserIds.length > 0 && assignedRoleIds.length === 0;
    
    const taskStatus = shouldAutoAssign ? 'claimed' : 'pending';

    const taskItem: any = {
      pk: guildId,
      sk: `task#${taskId}`,
      taskId,
      title,
      description,
      priority,
      dueDate,
      status: taskStatus,
      createdBy,
      createdAt: now,
    };

    if (assignedRoleIds.length > 0) {
      taskItem.assignedRoleIds = assignedRoleIds;
    }

    if (assignedUserIds.length > 0) {
      taskItem.assignedUserIds = assignedUserIds;
    }

    if (shouldAutoAssign) {
      if (multipleClaimsAllowed) {
        taskItem.multipleClaimsAllowed = true;
        taskItem.claimedByUsers = assignedUserIds;
        taskItem.claimedAt = now;
      } else {
        taskItem.claimedBy = assignedUserIds.length === 1 ? assignedUserIds[0] : assignedUserIds;
        taskItem.claimedAt = now;
      }
    } else if (multipleClaimsAllowed) {
      taskItem.multipleClaimsAllowed = true;
    }

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: taskItem,
      })
    );

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const statusEmoji = {
      pending: '📬',
      claimed: '📪',
      'ready-for-review': '✅',
      approved: '☑️'
    };

    const statusText = {
      pending: 'PENDING',
      claimed: 'CLAIMED',
      'ready-for-review': 'READY FOR REVIEW',
      approved: 'APPROVED'
    };

    const getAssignmentDisplay = () => {
      const parts = [];
      if (assignedRoleIds.length > 0) {
        parts.push(`**Roles:** ${assignedRoleIds.map(id => `<@&${id}>`).join(', ')}`);
      }
      if (assignedUserIds.length > 0) {
        parts.push(`**Users:** ${assignedUserIds.map(id => `<@${id}>`).join(', ')}`);
      }
      return parts.length > 0 ? parts.join('\n') : '`Anyone can claim`';
    };

    const taskFields = [
      {
        name: '📊 **Task Details**',
        value: [
          `**Priority:** ${priorityEmoji[priority as keyof typeof priorityEmoji]} \`${priority.toUpperCase()}\``,
          `**Assigned To:**\n${getAssignmentDisplay()}`,
          `**Due Date:** ${dueDate ? `📅 \`${dueDate}\`` : '`No due date set`'}`
        ].join('\n'),
        inline: false
      },
      {
        name: '👤 **Creator**',
        value: `<@${interaction.member?.user?.id || interaction.user?.id}>`,
        inline: true
      },
      {
        name: '⏰ **Created**',
        value: `<t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
        inline: true
      },
      {
        name: '📋 **Status**',
        value: `\`${statusEmoji[taskStatus as keyof typeof statusEmoji]} ${statusText[taskStatus as keyof typeof statusText]}\``,
        inline: true
      }
    ];

    const embed: APIEmbed = {
      title: '🎯 ✦ TASK CREATED ✦',
      description: `### ${priorityEmoji[priority as keyof typeof priorityEmoji]} **${title}**\n\n` +
                  `> ${description || '*No description provided*'}`,
      fields: taskFields,
      color: priority === 'high' ? 0xff4444 : priority === 'medium' ? 0xffaa00 : 0x00ff00,
      footer: {
        text: `Task Management System • ${shouldAutoAssign ? 'Task auto-assigned and claimed' : 'Ready to be claimed'}`,
        icon_url: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      },
      timestamp: now
    };

    const generatePingText = () => {
      const allPings = [];
      if (assignedRoleIds.length > 0) {
        allPings.push(...assignedRoleIds.map(id => `<@&${id}>`));
      }
      if (assignedUserIds.length > 0) {
        allPings.push(...assignedUserIds.map(id => `<@${id}>`));
      }
      return allPings.length > 0 ? `📢 **Task Assignment Notification:** ${allPings.join(' ')}` : null;
    };

    const pingText = generatePingText();

    const buttonComponents = [];

    if (taskStatus === 'pending') {
      buttonComponents.push({
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_claim_${taskId}`,
        label: 'Claim Task',
        style: ButtonStyle.Success as ButtonStyle.Success,
        emoji: { name: '✋' }
      });
    } else if (taskStatus === 'claimed') {
      buttonComponents.push({
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_complete_${taskId}`,
        label: 'Mark Complete',
        style: ButtonStyle.Primary as ButtonStyle.Primary,
        emoji: { name: '✅' }
      });

      const multiClaimEnabled = (taskItem as any).multipleClaimsAllowed || false;
      const userId = interaction.member?.user?.id || interaction.user?.id!;
      const isClaimedByUser = taskItem.claimedBy && (
        (Array.isArray(taskItem.claimedBy) && taskItem.claimedBy.includes(userId)) ||
        (!Array.isArray(taskItem.claimedBy) && taskItem.claimedBy === userId)
      );

      if (!multiClaimEnabled || isClaimedByUser) {
        buttonComponents.push({
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_unclaim_${taskId}`,
          label: 'Unclaim',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '↩️' }
        });
      }
    }

    buttonComponents.push(
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_list_all`,
        label: 'View All Tasks',
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        emoji: { name: '📋' }
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        label: 'Open Dashboard',
        style: ButtonStyle.Link as ButtonStyle.Link,
        url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
      }
    );

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: buttonComponents
    }];

    await updateResponse(interaction.application_id, interaction.token, {
      content: pingText || undefined,
      embeds: [embed],
      components
    });

  } catch (err) {
    console.error('Failed to create task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to create task. Please try again or contact an admin.',
    });
  }
};