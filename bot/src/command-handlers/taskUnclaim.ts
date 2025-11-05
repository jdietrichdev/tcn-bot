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

export const handleTaskUnclaim = async (
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
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ You can only unclaim tasks that you have claimed.',
      });
      return;
    }

    if (task.status !== 'claimed') {
      const statusMessages = {
        pending: '❌ This task is not claimed.',
        completed: '❌ This task has been completed and cannot be unclaimed.',
        approved: '❌ This task has been approved and cannot be unclaimed.',
      };
      
      await updateResponse(interaction.application_id, interaction.token, {
        content: statusMessages[task.status as keyof typeof statusMessages] || '❌ This task cannot be unclaimed.',
      });
      return;
    }

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET #status = :status REMOVE claimedBy, claimedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'pending',
        },
      })
    );

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const embed: APIEmbed = {
      title: '↩️ ═══════ TASK UNCLAIMED ═══════ 🔄',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.title}`,
      fields: [
        {
          name: 'Description',
          value: task.description || '*No description provided*',
          inline: false
        },
        {
          name: 'Status',
          value: '🟡 Available for claiming',
          inline: true
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
        }
      ],
      color: 0xffa500,
      footer: {
        text: `Task ID: ${taskId} • Available for claiming`,
      },
      timestamp: new Date().toISOString()
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_claim_${taskId}`,
          label: 'Claim Again',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '✋' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_available',
          label: 'Available Tasks',
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

    console.log(`Task ${taskId} unclaimed by user ${userId}`);

  } catch (err) {
    console.error('Failed to unclaim task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to unclaim task. Please try again or contact an admin.',
    });
  }
};