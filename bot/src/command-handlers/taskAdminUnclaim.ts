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

export const handleTaskAdminUnclaim = async (
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
    const adminUserId = interaction.member?.user?.id || interaction.user?.id;

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

    if (!task.claimedBy) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This task is not currently claimed by anyone.',
      });
      return;
    }

    if (task.status !== 'claimed' && task.status !== 'partially_completed') {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This task is not in a state that can be unclaimed (must be `claimed` or `partially_completed`).',
      });
      return;
    }

    const allowsMultiple = task.multipleClaimsAllowed === true;
    let previousClaimants: string[] = [];
    let updateExpression: string;
    let expressionAttributeValues: any;

    if (allowsMultiple) {
      previousClaimants = Array.isArray(task.claimedByUsers) ? task.claimedByUsers : [];
      updateExpression = 'SET #status = :status, unclaimedByAdmin = :adminId, unclaimedAt = :timestamp REMOVE claimedByUsers, claimedAt, completedByUsers';
      expressionAttributeValues = {
        ':status': 'pending',
        ':adminId': adminUserId,
        ':timestamp': new Date().toISOString(),
      };
    } else {
      if (task.claimedBy) {
        previousClaimants = [task.claimedBy];
      }
      updateExpression = 'SET #status = :status, unclaimedByAdmin = :adminId, unclaimedAt = :timestamp REMOVE claimedBy, claimedAt, assignedTo';
      expressionAttributeValues = {
        ':status': 'pending',
        ':adminId': adminUserId,
        ':timestamp': new Date().toISOString(),
      };
    }

    if (previousClaimants.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This task is not currently claimed by anyone.',
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
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const embed: APIEmbed = {
      title: '🛡️ ✦ ADMIN TASK UNCLAIM ✦',
      description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
                  `> ${task.description || '*No description provided*'}`,
      fields: [
        {
          name: '📊 **Task Information**',
          value: [
            `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} \`${task.priority.toUpperCase()}\``,
            `**Due Date:** ${task.dueDate ? `📅 \`${task.dueDate}\`` : '`No due date set`'}`,
            `**Assigned Role:** ${task.assignedRole ? `<@&${task.assignedRole}>` : '`Anyone can claim`'}`
          ].join('\n'),
          inline: false
        },
        {
          name: '👤 **Previous Claimant**',
          value: previousClaimants.map(id => `<@${id}>`).join(', '),
          inline: true
        },
        {
          name: '🛡️ **Unclaimed By Admin**',
          value: `<@${adminUserId}>`,
          inline: true
        },
        {
          name: '⏰ **Action Time**',
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        },
        {
          name: '🔄 **Status Change**',
          value: '**Previous:** `📪 CLAIMED`\n**Current:** `📬 PENDING`',
          inline: false
        },
        {
          name: '📋 **Admin Notice**',
          value: '```\n• Task forcibly unclaimed by administrator\n• Previous claimant has been notified\n• Task is now available for new claims\n• Original assignment removed\n```',
          inline: false
        }
      ],
      color: 0xff6b35,
      footer: {
        text: `Task Management System • Admin Override Action`,
      },
      timestamp: new Date().toISOString()
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
      ]
    }];

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components
    });

    console.log(`Task ${taskId} force-unclaimed by admin ${adminUserId} from user(s) ${previousClaimants.join(', ')}`);

  } catch (err) {
    console.error('Failed to admin unclaim task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to unclaim task. Please try again or contact technical support.',
    });
  }
};