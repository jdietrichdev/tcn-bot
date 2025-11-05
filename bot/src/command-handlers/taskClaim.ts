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

    if (task.status !== 'pending') {
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
      title: '🚀 ═══════ TASK CLAIMED ═══════ ✅',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.title}`,
      fields: [
        {
          name: 'Description',
          value: task.description || '*No description provided*',
          inline: false
        },
        {
          name: 'Priority',
          value: `${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.priority.toUpperCase()}`,
          inline: true
        },
        {
          name: 'Due Date',
          value: task.dueDate ? `📅 ${task.dueDate}` : '*No due date*',
          inline: true
        },
        {
          name: 'Claimed By',
          value: `<@${userId}>`,
          inline: true
        },
        {
          name: 'Next Steps',
          value: 'Work on this task and use `/task-complete` when finished!',
          inline: false
        }
      ],
      color: 0x0099ff,
      footer: {
        text: `Task ID: ${taskId}`,
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
          url: `${process.env.DASHBOARD_URL || 'https://tcn-bot.vercel.app'}/tasks`
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