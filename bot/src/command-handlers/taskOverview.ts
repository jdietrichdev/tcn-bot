import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskOverview = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (opt) => opt.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!taskOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task selection is required.',
        flags: 64
      });
      return;
    }

    const taskId = taskOption.value;
    const guildId = interaction.guild_id!;
    const userId = interaction.member?.user?.id || interaction.user?.id;

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
        flags: 64
      });
      return;
    }

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const statusEmoji = {
      pending: '📬',
      claimed: '📪',
      completed: '✅',
      approved: '☑️'
    };

    const statusText = {
      pending: 'PENDING',
      claimed: 'CLAIMED',
      completed: 'READY FOR REVIEW',
      approved: 'APPROVED'
    };

    const createdDate = new Date(task.createdAt);
    const claimedDate = task.claimedAt ? new Date(task.claimedAt) : null;
    const completedDate = task.completedAt ? new Date(task.completedAt) : null;
    const approvedDate = task.approvedAt ? new Date(task.approvedAt) : null;

    const embed: APIEmbed = {
      title: '🔍 ✦ TASK OVERVIEW ✦',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
                  `> ${task.description || '*No description provided*'}`,
      color: task.priority === 'high' ? 0xff4444 : task.priority === 'medium' ? 0xffaa00 : 0x00ff00,
      fields: [
        {
          name: '📊 **Task Information**',
          value: [
            `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} \`${task.priority.toUpperCase()}\``,
            `**Status:** ${statusEmoji[task.status as keyof typeof statusEmoji]} \`${statusText[task.status as keyof typeof statusText]}\``,
            `**Due Date:** ${task.dueDate ? `📅 \`${task.dueDate}\`` : '`No due date set`'}`
          ].join('\n'),
          inline: false
        },
        {
          name: '👥 **Assignment & Access**',
          value: [
            `**Assigned Role:** ${task.assignedRole ? `<@&${task.assignedRole}>` : '`Anyone can claim`'}`,
            `**Assigned User:** ${task.assignedTo ? `<@${task.assignedTo}>` : '`Not assigned to specific user`'}`,
            `**Currently Claimed:** ${task.claimedBy ? `<@${task.claimedBy}>` : '`No one`'}`
          ].join('\n'),
          inline: false
        },
        {
          name: '📅 **Timeline**',
          value: [
            `**Created:** <t:${Math.floor(createdDate.getTime() / 1000)}:F> by <@${task.createdBy}>`,
            claimedDate ? `**Claimed:** <t:${Math.floor(claimedDate.getTime() / 1000)}:F>` : '',
            completedDate ? `**Completed:** <t:${Math.floor(completedDate.getTime() / 1000)}:F>` : '',
            approvedDate ? `**Approved:** <t:${Math.floor(approvedDate.getTime() / 1000)}:F>` : ''
          ].filter(Boolean).join('\n'),
          inline: false
        }
      ],
      footer: {
        text: `Task Management System • ID: ${task.taskId}`,
      },
      timestamp: new Date().toISOString()
    };

    if (task.unclaimedByAdmin || task.assignedBy) {
      const historyItems = [];
      if (task.assignedBy) {
        historyItems.push(`**Assigned:** By <@${task.assignedBy}> ${task.assignedAt ? `<t:${Math.floor(new Date(task.assignedAt).getTime() / 1000)}:R>` : ''}`);
      }
      if (task.unclaimedByAdmin) {
        historyItems.push(`**Force Unclaimed:** By <@${task.unclaimedByAdmin}> ${task.unclaimedAt ? `<t:${Math.floor(new Date(task.unclaimedAt).getTime() / 1000)}:R>` : ''}`);
      }
      
      if (historyItems.length > 0) {
        embed.fields!.push({
          name: '📜 **Task History**',
          value: historyItems.join('\n'),
          inline: false
        });
      }
    }

    const canClaim = task.status === 'pending' && 
                    (!task.assignedRole || (interaction.member?.roles || []).includes(task.assignedRole)) &&
                    (!task.assignedTo || task.assignedTo === userId);

    const canUnclaim = task.status === 'claimed' && task.claimedBy === userId;
    
    const canComplete = task.status === 'claimed' && task.claimedBy === userId;

    const components = [];

    const actionButtons = [];
    
    if (canClaim) {
      actionButtons.push({
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_claim_${taskId}`,
        label: 'Claim Task',
        style: ButtonStyle.Success as ButtonStyle.Success,
        emoji: { name: '✋' }
      });
    }

    if (canUnclaim) {
      actionButtons.push({
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_unclaim_${taskId}`,
        label: 'Unclaim Task',
        style: ButtonStyle.Danger as ButtonStyle.Danger,
        emoji: { name: '❌' }
      });
    }

    if (canComplete) {
      actionButtons.push({
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `task_complete_${taskId}`,
        label: 'Mark Complete',
        style: ButtonStyle.Primary as ButtonStyle.Primary,
        emoji: { name: '✅' }
      });
    }

    const navButtons = [
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_list_all',
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
    ];

    if (actionButtons.length > 0) {
      components.push({
        type: ComponentType.ActionRow as ComponentType.ActionRow,
        components: actionButtons
      });
    }

    components.push({
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: navButtons
    });

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components
    });

    console.log(`Task overview viewed: ${taskId} by user ${userId}`);

  } catch (err) {
    console.error('Failed to show task overview:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to retrieve task overview. Please try again or contact an admin.',
      flags: 64
    });
  }
};