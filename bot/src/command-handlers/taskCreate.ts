import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataRoleOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

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
    
    const assignedRoleOption = interaction.data.options?.find(
      (opt) => opt.name === 'assigned-role'
    ) as APIApplicationCommandInteractionDataRoleOption;
    
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
    const description = descriptionOption?.value;
    const assignedRole = assignedRoleOption?.value;
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

    const taskItem = {
      pk: guildId,
      sk: `task#${taskId}`,
      taskId,
      title,
      description,
      assignedRole,
      priority,
      dueDate,
      status: 'pending',
      createdBy,
      createdAt: now,
    };

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

    const embed: APIEmbed = {
      title: '🎯 ╔══════ TASK CREATED ══════╗',
      description: `### ${priorityEmoji[priority as keyof typeof priorityEmoji]} **${title}**\n\n` +
                  `> ${description || '*No description provided*'}`,
      fields: [
        {
          name: '📊 **Task Details**',
          value: [
            `**Priority:** ${priorityEmoji[priority as keyof typeof priorityEmoji]} \`${priority.toUpperCase()}\``,
            `**Assigned To:** ${assignedRole ? `<@&${assignedRole}>` : '`Anyone can claim`'}`,
            `**Due Date:** ${dueDate ? `📅 \`${dueDate}\`` : '`No due date set`'}`,
            `**Task ID:** \`${taskId}\``
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
          value: '`🔄 PENDING`',
          inline: true
        }
      ],
      color: priority === 'high' ? 0xff4444 : priority === 'medium' ? 0xffaa00 : 0x00ff00,
      footer: {
        text: `Task Management System • Ready to be claimed`,
        icon_url: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      },
      timestamp: now
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_claim_${taskId}`,
          label: 'Claim Task',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '✋' }
        },
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
      ]
    }];

    await updateResponse(interaction.application_id, interaction.token, {
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