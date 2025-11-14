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
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { storeCacheInDynamoDB } from '../component-handlers/taskListButton';

const formatTaskAssignments = (task: any): string => {
  const parts: string[] = [];

  if (task.claimedBy) {
    parts.push(`👤 <@${task.claimedBy}>`);
  }

  if (task.assignedRoleIds && Array.isArray(task.assignedRoleIds) && task.assignedRoleIds.length > 0) {
    const roleList = task.assignedRoleIds.map((id: string) => `<@&${id}>`).join(', ');
    parts.push(`🎭 ${roleList}`);
  }
  else if (task.assignedRole) {
    parts.push(`🎭 <@&${task.assignedRole}>`);
  }

  if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
    const userList = task.assignedTo.map((id: string) => `<@${id}>`).join(', ');
    parts.push(`👥 ${userList}`);
  }
  else if (task.assignedTo) {
    parts.push(`👥 <@${task.assignedTo}>`);
  }

  return parts.length > 0 ? `\n    ${parts.join(' • ')}` : '';
};

export const generateTaskListResponse = async (
  guildId: string,
  statusFilter?: string,
  roleFilter?: string,
  userFilter?: string,
  interactionId?: string
): Promise<{ embeds: APIEmbed[], components: any[], cacheData?: any }> => {
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

  let tasks = queryResult.Items || [];

  if (statusFilter) {
    tasks = tasks.filter(task => task.status === statusFilter);
  }
  if (roleFilter) {
    tasks = tasks.filter(task => task.assignedRole === roleFilter);
  }
  if (userFilter) {
    tasks = tasks.filter(task =>
      task.createdBy === userFilter ||
      task.claimedBy === userFilter ||
      task.completedBy === userFilter
    );
  }

  const priorityOrder = { high: 1, medium: 2, low: 3 };
  tasks.sort((a: any, b: any) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;

    if (aPriority !== bPriority) return aPriority - bPriority;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const allTasks = queryResult.Items || [];

  const tasksToCalculateFrom = (statusFilter || roleFilter || userFilter) ? tasks : allTasks;
  const taskCounts = {
    pending: tasksToCalculateFrom.filter(t => t.status === 'pending').length,
    claimed: tasksToCalculateFrom.filter(t => t.status === 'claimed').length,
    completed: tasksToCalculateFrom.filter(t => t.status === 'completed').length,
    approved: tasksToCalculateFrom.filter(t => t.status === 'approved').length,
  };

  const filterParts = [];
  if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
  if (roleFilter) filterParts.push(`Role: <@&${roleFilter}>`);
  if (userFilter) filterParts.push(`User: <@${userFilter}>`);
  const filterDescription = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';
  const isFiltered = filterParts.length > 0;

  if (tasks.length === 0) {
    const noTasksEmbed: APIEmbed = {
      title: `📋 ✦ TASK LIST${isFiltered ? ' (FILTERED)' : ''} ✦ 📝`,
      description: isFiltered
        ? `No tasks found matching filters${filterDescription}.`
        : 'No tasks found. Create your first task with `/task-create`!',
      color: 0x808080,
      fields: [
        {
          name: `📊 Task Summary${isFiltered ? ' (Filtered Results)' : ''}`,
          value: `📬 Pending: ${taskCounts.pending}\n📪 Claimed: ${taskCounts.claimed}\n✅ Ready for Review: ${taskCounts.completed}\n☑️ Approved: ${taskCounts.approved}`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };

    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_create_new',
          label: 'Create Task',
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

    return { embeds: [noTasksEmbed], components };
  }

  const tasksPerPage = 8;
  const totalPages = Math.ceil(tasks.length / tasksPerPage);
  const currentPage = 0;
  const displayTasks = tasks.slice(0, tasksPerPage);

  const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
  const statusEmoji = {
    pending: '📬',
    claimed: '📪',
    completed: '✅',
    approved: '☑️'
  };

  const taskList = displayTasks.map((task: any, index: number) => {
    const priority = priorityEmoji[task.priority as keyof typeof priorityEmoji] || '⚪';
    const status = statusEmoji[task.status as keyof typeof statusEmoji] || '❓';
    const dueDate = task.dueDate ? ` (Due: ${task.dueDate})` : '';
    const assignments = formatTaskAssignments(task);

    return `${priority}${status} **${task.title}**${dueDate}${assignments}`;
  }).join('\n');

  const truncateEmbedDescription = (description: string, maxLength: number): string => {
    if (description.length > maxLength) {
      return description.slice(0, maxLength - 3) + '...';
    }
    return description;
  };

  const embedDescription = taskList || '`No tasks found matching the current filters.`';
  const truncatedDescription = truncateEmbedDescription(embedDescription, 4096); 

  const embed: APIEmbed = {
    title: `📋 ✦ TASK BOARD${isFiltered ? ' (FILTERED)' : ''} ✦ 📝`,
    description: truncatedDescription,
    color: 0x5865F2,
    fields: [
      {
        name: `📊 **Task Statistics${isFiltered ? ' (Filtered)' : ''}**`,
        value: [
          `**📬 Pending:** \`${taskCounts.pending}\``,
          `**📪 In Progress:** \`${taskCounts.claimed}\``,
          `**✅ Completed:** \`${taskCounts.completed}\``,
          `**☑️ Approved:** \`${taskCounts.approved}\``
        ].join('\n'),
        inline: true
      },
      {
        name: '📖 **Status Legend**',
        value: [
          '**Priorities:**',
          '🔴 `High Priority`',
          '🟡 `Medium Priority`',
          '🟢 `Low Priority`',
          '',
          '**Statuses:**',
          '📬 `Pending`',
          '📪 `Claimed`',
          '✅ `Ready for Review`',
          '☑️ `Approved`'
        ].join('\n'),
        inline: true
      }
    ],
    footer: {
      text: totalPages > 1
        ? `Page 1 of ${totalPages}  •  ${tasks.length} task${tasks.length !== 1 ? 's' : ''} displayed`
        : `📊 ${tasks.length} task${tasks.length !== 1 ? 's' : ''} on the board`,
    },
    timestamp: new Date().toISOString()
  };

  if (statusFilter || roleFilter || userFilter) {
    const filterInfo = [];
    if (statusFilter) filterInfo.push(`Status: ${statusFilter}`);
    if (roleFilter) filterInfo.push(`Role: <@&${roleFilter}>`);
    if (userFilter) filterInfo.push(`User: <@${userFilter}>`);

    embed.fields!.unshift({
      name: '🔍 Active Filters',
      value: filterInfo.join(', '),
      inline: false
    });
  }

  const components = [];

  if (totalPages > 1 && interactionId) {
    components.push({
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_list_first_${interactionId}`,
          emoji: { name: '⏮️' },
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          disabled: currentPage === 0
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_list_prev_${interactionId}`,
          emoji: { name: '◀️' },
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          disabled: currentPage === 0
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_list_page_${interactionId}`,
          label: `1 / ${totalPages}`,
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          disabled: true
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_list_next_${interactionId}`,
          emoji: { name: '▶️' },
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          disabled: currentPage === totalPages - 1
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: `task_list_last_${interactionId}`,
          emoji: { name: '⏭️' },
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          disabled: currentPage === totalPages - 1
        }
      ]
    });
  }

  components.push({
    type: ComponentType.ActionRow as ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_create_new',
        label: 'Create Task',
        style: ButtonStyle.Success as ButtonStyle.Success,
        emoji: { name: '➕' }
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_refresh_list',
        label: 'Refresh',
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        emoji: { name: '🔄' }
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_list_all',
        label: 'All Tasks',
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        emoji: { name: '📝' }
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_list_my',
        label: 'My Tasks',
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        emoji: { name: '👤' }
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        label: 'Open Dashboard',
        style: ButtonStyle.Link as ButtonStyle.Link,
        url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
      }
    ]
  });

  components.push({
    type: ComponentType.ActionRow as ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: 'task_list_completed',
        label: 'Completed',
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        emoji: { name: '📋' }
      }
    ]
  });

  let cacheData;
  if (totalPages > 1 && interactionId) {
    cacheData = {
      tasks,
      filters: {
        status: statusFilter,
        role: roleFilter,
        user: userFilter
      },
      channelId: '',
      messageId: '',
      allTaskCounts: taskCounts
    };
  }

  const validateDiscordPayload = (embeds: APIEmbed[], components: { type: ComponentType.ActionRow, components: any[] }[]) => {
    const embedSize = JSON.stringify(embeds).length;
    if (embedSize > 6000) {
      throw new Error(`Embed size exceeds Discord limit: ${embedSize} characters`);
    }

    if (components.length > 5) {
      throw new Error(`Action row count exceeds Discord limit: ${components.length}`);
    }

    for (const row of components) {
      if (row.components.length > 5) {
        throw new Error(`Component count in an action row exceeds Discord limit: ${row.components.length}`);
      }
    }

    const totalComponents = components.reduce((count: number, row: { components: any[] }) => count + row.components.length, 0);
    if (totalComponents > 25) {
      throw new Error(`Total component count exceeds Discord limit: ${totalComponents}`);
    }
  };

  try {
    validateDiscordPayload([embed], components);
  } catch (error) {
    console.error('Error generating task list response:', error);
    return {
      embeds: [{
        title: 'Error',
        description: 'An error occurred while generating the task list. Please try again later.',
        color: 0xFF0000,
      }],
      components: [],
    };
  }

  return { embeds: [embed], components, cacheData };
};

export const handleTaskList = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const statusOption = interaction.data.options?.find(
      (opt) => opt.name === 'status'
    ) as APIApplicationCommandInteractionDataStringOption;

    const roleOption = interaction.data.options?.find(
      (opt) => opt.name === 'role'
    ) as APIApplicationCommandInteractionDataRoleOption;

    const userOption = interaction.data.options?.find(
      (opt) => opt.name === 'user'
    ) as APIApplicationCommandInteractionDataUserOption;

    const guildId = interaction.guild_id!;
    const statusFilter = statusOption?.value;
    const roleFilter = roleOption?.value;
    const userFilter = userOption?.value;

    const { embeds, components, cacheData } = await generateTaskListResponse(
      guildId,
      statusFilter,
      roleFilter,
      userFilter,
      interaction.id
    );

    await updateResponse(interaction.application_id, interaction.token, {
      embeds,
      components
    });

    if (cacheData) {
      const { getOriginalResponse } = await import('../adapters/discord-adapter');

      try {
        const message = await getOriginalResponse(interaction.application_id, interaction.token);

        cacheData.channelId = interaction.channel?.id || '';
        cacheData.messageId = message.id;

        await storeCacheInDynamoDB(interaction.id, cacheData);
        console.log(`Cached task list message: interaction=${interaction.id}, message=${message.id}, channel=${cacheData.channelId}`);
      } catch (error) {
        console.error('Failed to cache task list message:', error);
      }
    }

  } catch (err) {
    console.error('Failed to list tasks:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to retrieve tasks. Please try again or contact an admin.',
    });
  }
};