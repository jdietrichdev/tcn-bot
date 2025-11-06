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

export const handleTaskApprove = async (
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
        content: '❌ Task not found. It may have been deleted.',
      });
      return;
    }

    if (task.status !== 'completed') {
      const statusMessages = {
        pending: '❌ This task needs to be completed before it can be approved.',
        claimed: '❌ This task is still being worked on and cannot be approved yet.',
        approved: '❌ This task has already been approved.',
      };
      
      await updateResponse(interaction.application_id, interaction.token, {
        content: statusMessages[task.status as keyof typeof statusMessages] || '❌ This task cannot be approved.',
      });
      return;
    }

    const now = new Date().toISOString();
    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'approved',
          ':approvedBy': userId,
          ':approvedAt': now,
        },
      })
    );

    const claimedAt = task.claimedAt ? new Date(task.claimedAt) : null;
    const completedAt = task.completedAt ? new Date(task.completedAt) : null;
    let durationText = 'Unknown';
    
    if (claimedAt && completedAt) {
      const durationMs = completedAt.getTime() - claimedAt.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const durationHours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (durationDays > 0) {
        durationText = `${durationDays} day${durationDays !== 1 ? 's' : ''}`;
        if (durationHours > 0) durationText += `, ${durationHours}h`;
      } else if (durationHours > 0) {
        durationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
      } else {
        durationText = '< 1 hour';
      }
    }

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const embed: APIEmbed = {
      title: '👑 ══════ TASK APPROVED ══════ ✅',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.title}`,
      fields: [
        {
          name: 'Description',
          value: task.description || '*No description provided*',
          inline: false
        },
        {
          name: 'Completion Notes',
          value: task.completionNotes || '*No notes provided*',
          inline: false
        },
        {
          name: 'Task Details',
          value: [
            `**Created by:** <@${task.createdBy}>`,
            `**Completed by:** <@${task.completedBy}>`,
            `**Approved by:** <@${userId}>`,
            `**Duration:** ${durationText}`,
          ].join('\n'),
          inline: true
        },
        {
          name: 'Timeline',
          value: [
            `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`,
            task.claimedAt ? `**Claimed:** <t:${Math.floor(new Date(task.claimedAt).getTime() / 1000)}:R>` : '',
            task.completedAt ? `**Completed:** <t:${Math.floor(new Date(task.completedAt).getTime() / 1000)}:R>` : '',
            `**Approved:** <t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
          ].filter(Boolean).join('\n'),
          inline: true
        }
      ],
      color: 0x00ff00,
      footer: {
        text: `Task ID: ${taskId} • Approved & Removed from Board`,
      },
      timestamp: now
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_approved',
          label: 'View Approved Tasks',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '✅' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_pending',
          label: 'Pending Approvals',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '⏳' }
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

    console.log(`Task ${taskId} approved by ${username} (${userId})`);

  } catch (err) {
    console.error('Failed to approve task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to approve task. Please try again or contact an admin.',
    });
  }
};