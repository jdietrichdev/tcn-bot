import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskDelete = async (
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
        content: '❌ Task not found. It may have already been deleted.',
      });
      return;
    }

    const taskTitle = task.title;
    const taskStatus = task.status;
    const taskPriority = task.priority;
    const taskDescription = task.description;
    const taskCreatedBy = task.createdBy;
    const taskClaimedBy = task.claimedBy;

    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
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
      completed: '✅',
      approved: '☑️'
    };

    const embed: APIEmbed = {
      title: '🗑️ ╔═ TASK DELETED ═╗ ❌',
      description: `### ${priorityEmoji[taskPriority as keyof typeof priorityEmoji]} ~~**${taskTitle}**~~\n\n` +
                  `> *This task has been permanently removed from the system.*`,
      fields: [
        {
          name: '📋 **Task Details**',
          value: [
            `**Description:** ${taskDescription || '`No description provided`'}`,
            `**Status:** ${statusEmoji[taskStatus as keyof typeof statusEmoji]} \`${taskStatus.toUpperCase()}\``,
            `**Priority:** ${priorityEmoji[taskPriority as keyof typeof priorityEmoji]} \`${taskPriority.toUpperCase()}\``
          ].join('\n'),
          inline: false
        },
        {
          name: '👥 **Task History**',
          value: [
            `**Created by:** <@${taskCreatedBy}>`,
            taskClaimedBy ? `**Claimed by:** <@${taskClaimedBy}>` : '`Never claimed`',
            `**Deleted by:** <@${userId}>`
          ].filter(line => !line.includes('undefined')).join('\n'),
          inline: true
        },
        {
          name: '⏰ **Deletion Info**',
          value: `**When:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        },
        {
          name: '⚠️ **Warning**',
          value: '```\n❌ This action is permanent\n🔒 Task cannot be recovered\n📊 Removed from all analytics\n```',
          inline: false
        }
      ],
      color: 0xff4444,
      footer: {
        text: `Task Management System • Task permanently removed`,
      },
      timestamp: new Date().toISOString()
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_all',
          label: 'View Remaining Tasks',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '📋' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_create_new',
          label: 'Create New Task',
          style: ButtonStyle.Success as ButtonStyle.Success,
          emoji: { name: '➕' }
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

    console.log(`Task ${taskId} ("${taskTitle}") deleted by ${username} (${userId})`);

    if (taskClaimedBy && taskStatus === 'claimed') {
      console.log(`WARNING: Claimed task deleted - this may need user notification`);
    }

  } catch (err) {
    console.error('Failed to delete task:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to delete task. Please try again or contact an admin.',
    });
  }
};