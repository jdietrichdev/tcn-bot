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
      title: '↩️ ✦ TASK UNCLAIMED ✦ 🔄',
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
          name: '🔄 **Status Change**',
          value: '**Previous:** `� IN PROGRESS`\n**Current:** `🟡 AVAILABLE`',
          inline: true
        },
        {
          name: '⏰ **Unclaimed At**',
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        },
        {
          name: '📋 **Next Steps**',
          value: '```\n• Task is now available for claiming\n• Anyone can claim this task\n• No progress has been lost\n```',
          inline: false
        }
      ],
      color: 0xffa500,
      footer: {
        text: `Task Management System • Available for claiming`,
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
          url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
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