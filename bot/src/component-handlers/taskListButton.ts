import {
  APIMessageComponentInteraction,
  ComponentType,
  ButtonStyle,
  APIEmbed,
  InteractionResponseType
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { updateMessage, updateResponse } from '../adapters/discord-adapter';
import { generateTaskListResponse } from '../command-handlers/taskList';

export interface TaskListCacheData {
  tasks: any[];
  filters: {
    status?: string;
    role?: string;
    user?: string;
  };
  channelId: string;
  messageId: string;
  allTaskCounts: {
    pending: number;
    claimed: number;
    completed: number;
    approved: number;
  };
}

export const formatTaskAssignments = (task: any): string => {
  const parts: string[] = [];
  if (task.claimedBy) parts.push(`👤 <@${task.claimedBy}>`);
  if (task.assignedRoleIds && Array.isArray(task.assignedRoleIds) && task.assignedRoleIds.length > 0) {
    const roleList = task.assignedRoleIds.map((id: string) => `<@&${id}>`).join(', ');
    parts.push(`🎭 ${roleList}`);
  } else if (task.assignedRole) {
    parts.push(`🎭 <@&${task.assignedRole}>`);
  }
  if (task.assignedUserIds && Array.isArray(task.assignedUserIds) && task.assignedUserIds.length > 0) {
    const userList = task.assignedUserIds.map((id: string) => `<@${id}>`).join(', ');
    parts.push(`👥 ${userList}`);
  } else if (task.assignedTo) {
    parts.push(`👥 <@${task.assignedTo}>`);
  }
  return parts.length > 0 ? `\n    ↳ ${parts.join(' • ')}` : '';
};

export const storeCacheInDynamoDB = async (interactionId: string, data: TaskListCacheData) => {
  const ttl = Math.floor(Date.now() / 1000) + (15 * 60);
  await dynamoDbClient.send(
    new PutCommand({
      TableName: 'BotTable',
      Item: {
        pk: 'task-list-cache',
        sk: interactionId,
        data: data,
        ttl: ttl
      }
    })
  );
  console.log(`Stored task list cache in DynamoDB for interaction ID: ${interactionId}`);
};

export const getCacheFromDynamoDB = async (interactionId: string): Promise<TaskListCacheData | null> => {
  try {
    const result = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: 'task-list-cache',
          sk: interactionId
        }
      })
    );
    if (result.Item && result.Item.data) {
      console.log(`Retrieved task list cache from DynamoDB for interaction ID: ${interactionId}`);
      return result.Item.data as TaskListCacheData;
    }
    return null;
  } catch (error) {
    console.error(`Failed to retrieve task list cache from DynamoDB:`, error);
    return null;
  }
};
export const handleTaskListPagination = async (
  interaction: APIMessageComponentInteraction,
  customId: string
): Promise<any> => {
  // Handle refresh
  if (customId === 'task_refresh_list') {
    console.log(`Handling task_refresh_list button for user ${interaction.member?.user?.id || interaction.user?.id} - sending ephemeral message`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '🔄 Use `/task-list` to refresh and view the latest tasks!',
        flags: 64
      }
    };
  }

  // Handle create
  if (customId === 'task_create_new') {
    console.log(`Handling task_create_new button for user ${interaction.member?.user?.id || interaction.user?.id} - sending ephemeral message`);
    try {
      const fakeInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-create',
          options: []
        }
      };
      const { handleTaskCreate } = await import('../command-handlers/taskCreate');
      await handleTaskCreate(fakeInteraction as any);
    } catch (error) {
      console.error('Error in create operation:', error);
    }
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '✨ Task creation modal opened!',
        flags: 64
      }
    };
  }

  // Handle view all
  if (customId === 'task_list_all') {
    console.log(`Handling task_list_all button for user ${interaction.member?.user?.id || interaction.user?.id} - generating task list response`);
    const guildId = interaction.guild_id!;
    const { embeds, components } = await generateTaskListResponse(guildId);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64
      }
    };
  }

  // Handle my tasks
  if (customId === 'task_list_my') {
    console.log(`Handling task_list_my button for user ${interaction.member?.user?.id || interaction.user?.id} - generating task list response`);
    const guildId = interaction.guild_id!;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const { embeds, components } = await generateTaskListResponse(guildId, undefined, undefined, userId);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64
      }
    };
  }

  // Handle completed tasks
  if (customId === 'task_list_completed') {
    console.log(`Handling task_list_completed button for user ${interaction.member?.user?.id || interaction.user?.id} - generating task list response`);
    const guildId = interaction.guild_id!;
    const { embeds, components } = await generateTaskListResponse(guildId, 'completed');
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64
      }
    };
  }

  const parts = customId.split('_');
  const action = parts[2];
  const originalInteractionId = parts[3];

  console.log(`Task list pagination: action=${action}, originalInteractionId=${originalInteractionId}`);

  let data = await getCacheFromDynamoDB(originalInteractionId);

  if (!data) {
    console.error(`Task list cache miss for interaction ID: ${originalInteractionId}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '⚠️ This pagination has expired. Please run `/task-list` again.',
        flags: 64
      }
    };
  }

  console.log(`Task list cache hit! Data has ${data.tasks.length} tasks`);

  const currentMessage = interaction.message;
  const currentPageMatch = currentMessage.embeds?.[0]?.footer?.text?.match(/Page (\d+) of (\d+)/);
  if (!currentPageMatch) {
    return {
      type: InteractionResponseType.UpdateMessage,
      data: {}
    };
  }

  const currentPage = parseInt(currentPageMatch[1]) - 1;
  const totalPages = parseInt(currentPageMatch[2]);

  let newPage = currentPage;
  switch (action) {
    case 'first':
      newPage = 0;
      break;
    case 'prev':
      newPage = Math.max(0, currentPage - 1);
      break;
    case 'next':
      newPage = Math.min(totalPages - 1, currentPage + 1);
      break;
    case 'last':
      newPage = totalPages - 1;
      break;
  }

  const tasksPerPage = 8;
  const pages: any[][] = [];
  for (let i = 0; i < data.tasks.length; i += tasksPerPage) {
    pages.push(data.tasks.slice(i, i + tasksPerPage));
  }

  const createTaskEmbed = (pageIndex: number): APIEmbed => {
    if (!data) {
      return {
        title: `📋 ✦ TASK BOARD ✦ 📝`,
        description: '`No tasks found.`',
        color: 0x5865F2,
      };
    }

    const page = pages[pageIndex];
    const startIndex = pageIndex * tasksPerPage;

    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    const statusEmoji = {
      pending: '📬',
      claimed: '📪',
      completed: '✅',
      approved: '☑️'
    };

    const taskList = page.map((task: any, index: number) => {
      const priority = priorityEmoji[task.priority as keyof typeof priorityEmoji] || '⚪';
      const status = statusEmoji[task.status as keyof typeof statusEmoji] || '❓';
      const dueDate = task.dueDate ? ` (Due: ${task.dueDate})` : '';
      const assignments = formatTaskAssignments(task);

      return `${priority}${status} **${task.title}**${dueDate}${assignments}`;
    }).join('\n');

    const embed: APIEmbed = {
      title: `📋 ✦ TASK BOARD ✦ 📝`,
      description: taskList || '`No tasks found.`',
      color: 0x5865F2,
      fields: [
        {
          name: '📊 **Task Statistics**',
          value: [
            `**📬 Pending:** \`${data.allTaskCounts.pending}\``,
            `**📪 In Progress:** \`${data.allTaskCounts.claimed}\``,
            `**✅ Completed:** \`${data.allTaskCounts.completed}\``,
            `**☑️ Approved:** \`${data.allTaskCounts.approved}\``
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
        text: `Page ${pageIndex + 1} of ${pages.length}  •  ${data.tasks.length} tasks displayed`,
      },
      timestamp: new Date().toISOString()
    };

    return embed;
  };

  const createComponents = (currentPage: number) => {
    const components = [];

    if (pages.length > 1) {
      components.push({
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            custom_id: `task_list_first_${originalInteractionId}`,
            emoji: { name: '⏮️' },
            style: ButtonStyle.Secondary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button,
            custom_id: `task_list_prev_${originalInteractionId}`,
            emoji: { name: '◀️' },
            style: ButtonStyle.Primary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button,
            custom_id: `task_list_page_${originalInteractionId}`,
            label: `${currentPage + 1} / ${pages.length}`,
            style: ButtonStyle.Secondary,
            disabled: true
          },
          {
            type: ComponentType.Button,
            custom_id: `task_list_next_${originalInteractionId}`,
            emoji: { name: '▶️' },
            style: ButtonStyle.Primary,
            disabled: currentPage === pages.length - 1
          },
          {
            type: ComponentType.Button,
            custom_id: `task_list_last_${originalInteractionId}`,
            emoji: { name: '⏭️' },
            style: ButtonStyle.Secondary,
            disabled: currentPage === pages.length - 1
          }
        ]
      });
    }

    components.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          custom_id: 'task_refresh_list',
          label: 'Refresh',
          style: ButtonStyle.Secondary,
          emoji: { name: '🔄' }
        },
        {
          type: ComponentType.Button,
          custom_id: 'task_create_new',
          label: 'Create Task',
          style: ButtonStyle.Success,
          emoji: { name: '➕' }
        },
        {
          type: ComponentType.Button,
          custom_id: 'task_list_all',
          label: 'View All',
          style: ButtonStyle.Primary,
          emoji: { name: '📋' }
        },
        {
          type: ComponentType.Button,
          label: 'Open Dashboard',
          style: ButtonStyle.Link,
          url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
        }
      ]
    });

    return components;
  };

  const result = {
    embeds: [createTaskEmbed(newPage)],
    components: createComponents(newPage) as any
  };

  await updateResponse(interaction.application_id, interaction.token, result);
  return;
};

export const refreshTaskListMessages = async (guildId: string) => {
  console.log(`[DEBUG] Refreshing task list messages for guild: ${guildId}`);

  const cacheResult = await dynamoDbClient.send(
    new QueryCommand({
      TableName: 'BotTable',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'task-list-cache',
        ':sk': 'task-list-cache',
      },
    })
  );

  if (!cacheResult.Items || cacheResult.Items.length === 0) {
    console.log('[DEBUG] No task list cache entries found');
    return;
  }

  console.log(`[DEBUG] Found ${cacheResult.Items.length} task list cache entries to refresh`);

  const taskResult = await dynamoDbClient.send(
    new QueryCommand({
      TableName: 'BotTable',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': guildId,
        ':sk': 'task#',
      },
    })
  );

  const allTasks = taskResult.Items || [];

  const allTaskCounts = {
    pending: allTasks.filter(task => task.status === 'pending').length,
    claimed: allTasks.filter(task => task.status === 'claimed').length,
    completed: allTasks.filter(task => task.status === 'completed').length,
    approved: allTasks.filter(task => task.status === 'approved').length,
  };

  for (const item of cacheResult.Items) {
    const interactionId = item.sk;
    const cacheData = item.data as TaskListCacheData;

    try {
      if (!cacheData.messageId || !cacheData.channelId) {
        console.log(`Skipping cache entry ${interactionId} - missing messageId or channelId`);
        continue;
      }

      console.log(`[DEBUG] Processing cache entry: interaction=${interactionId}, messageId=${cacheData.messageId}, channelId=${cacheData.channelId}`);
      console.log(`[DEBUG] Cache filters: ${JSON.stringify(cacheData.filters)}`);

      let filteredTasks = allTasks;
      console.log(`[DEBUG] Total tasks before filtering: ${allTasks.length}`);

      if (cacheData.filters.status) {
        filteredTasks = filteredTasks.filter(task => task.status === cacheData.filters.status);
        console.log(`[DEBUG] After status filter (${cacheData.filters.status}): ${filteredTasks.length} tasks`);
      }

      if (cacheData.filters.role) {
        filteredTasks = filteredTasks.filter(task => {
          if (task.assignedRoleIds && Array.isArray(task.assignedRoleIds)) {
            return task.assignedRoleIds.includes(cacheData.filters.role);
          }
          return task.assignedRole === cacheData.filters.role;
        });
        console.log(`[DEBUG] After role filter (${cacheData.filters.role}): ${filteredTasks.length} tasks`);
      }

      if (cacheData.filters.user) {
        filteredTasks = filteredTasks.filter(task => {
          if (task.assignedUserIds && Array.isArray(task.assignedUserIds)) {
            if (task.assignedUserIds.includes(cacheData.filters.user)) return true;
          }
          if (task.assignedTo === cacheData.filters.user) return true;

          if (task.claimedBy === cacheData.filters.user) return true;

          return false;
        });
        console.log(`[DEBUG] After user filter (${cacheData.filters.user}): ${filteredTasks.length} tasks`);
      }

      cacheData.tasks = filteredTasks;
      cacheData.allTaskCounts = allTaskCounts;
      console.log(`[DEBUG] Updated cache with ${filteredTasks.length} filtered tasks`);

      const tasksPerPage = 8;
      const pages: any[][] = [];
      for (let i = 0; i < filteredTasks.length; i += tasksPerPage) {
        pages.push(filteredTasks.slice(i, i + tasksPerPage));
      }

      if (pages.length === 0) {
        const embed: APIEmbed = {
          title: `📋 ✦ TASK BOARD${cacheData.filters.status || cacheData.filters.role || cacheData.filters.user ? ' (FILTERED)' : ''} ✦ 📝`,
          description: '`No tasks found.`',
          color: 0x5865F2,
          fields: [
            {
              name: `📊 **Task Statistics${cacheData.filters.status || cacheData.filters.role || cacheData.filters.user ? ' (Filtered)' : ''}**`,
              value: [
                `**📬 Pending:** \`${allTaskCounts.pending}\``,
                `**📪 In Progress:** \`${allTaskCounts.claimed}\``,
                `**✅ Completed:** \`${allTaskCounts.completed}\``,
                `**☑️ Approved:** \`${allTaskCounts.approved}\``
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
            text: `Page 1 of 1  •  0 tasks displayed`,
          },
          timestamp: new Date().toISOString()
        };

        if (cacheData.filters.status || cacheData.filters.role || cacheData.filters.user) {
          const filterInfo = [];
          if (cacheData.filters.status) filterInfo.push(`Status: ${cacheData.filters.status}`);
          if (cacheData.filters.role) filterInfo.push(`Role: <@&${cacheData.filters.role}>`);
          if (cacheData.filters.user) filterInfo.push(`User: <@${cacheData.filters.user}>`);

          embed.fields!.unshift({
            name: '🔍 Active Filters',
            value: filterInfo.join(', '),
            inline: false
          });
        }

        console.log(`[DEBUG] Updating message ${cacheData.messageId} in channel ${cacheData.channelId} with ${pages.length} pages`);
        await updateMessage(cacheData.channelId, cacheData.messageId, {
          embeds: [embed],
          components: []
        });
        console.log(`[DEBUG] Successfully updated message ${cacheData.messageId}`);
      } else {
        const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
        const statusEmoji = {
          pending: '📬',
          claimed: '📪',
          completed: '✅',
          approved: '☑️'
        };

        const taskList = pages[0].map((task: any, index: number) => {
          const priority = priorityEmoji[task.priority as keyof typeof priorityEmoji] || '⚪';
          const status = statusEmoji[task.status as keyof typeof statusEmoji] || '❓';
          const dueDate = task.dueDate ? ` (Due: ${task.dueDate})` : '';
          const assignments = formatTaskAssignments(task);

          return `${priority}${status} **${task.title}**${dueDate}${assignments}`;
        }).join('\n');

        const embed: APIEmbed = {
          title: `📋 ✦ TASK BOARD${cacheData.filters.status || cacheData.filters.role || cacheData.filters.user ? ' (FILTERED)' : ''} ✦ 📝`,
          description: (() => {
            const filterParts = [];
            if (cacheData.filters.status) filterParts.push(`Status: ${cacheData.filters.status}`);
            if (cacheData.filters.role) filterParts.push(`Role: <@&${cacheData.filters.role}>`);
            if (cacheData.filters.user) filterParts.push(`User: <@${cacheData.filters.user}>`);

            const isFiltered = filterParts.length > 0;
            const filterDescription = isFiltered ? ` (${filterParts.join(', ')})` : '';

            if (isFiltered) {
              return `Showing ${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} matching filters${filterDescription}\n\n${taskList || '`No tasks found matching the current filters.`'}`;
            }
            return taskList || '`No tasks found matching the current filters.`';
          })(),
          color: 0x5865F2,
          fields: [
            {
              name: `📊 **Task Statistics${cacheData.filters.status || cacheData.filters.role || cacheData.filters.user ? ' (Filtered)' : ''}**`,
              value: [
                `**📬 Pending:** \`${allTaskCounts.pending}\``,
                `**📪 In Progress:** \`${allTaskCounts.claimed}\``,
                `**✅ Completed:** \`${allTaskCounts.completed}\``,
                `**☑️ Approved:** \`${allTaskCounts.approved}\``
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
            text: `Page 1 of ${pages.length}  •  ${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''} displayed`,
          },
          timestamp: new Date().toISOString()
        };

        if (cacheData.filters.status || cacheData.filters.role || cacheData.filters.user) {
          const filterInfo = [];
          if (cacheData.filters.status) filterInfo.push(`Status: ${cacheData.filters.status}`);
          if (cacheData.filters.role) filterInfo.push(`Role: <@&${cacheData.filters.role}>`);
          if (cacheData.filters.user) filterInfo.push(`User: <@${cacheData.filters.user}>`);

          embed.fields!.unshift({
            name: '🔍 Active Filters',
            value: filterInfo.join(', '),
            inline: false
          });
        }

        const createComponents = (currentPage: number) => {
          const components = [];

          if (pages.length > 1) {
            components.push({
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  custom_id: `task_list_first_${interactionId}`,
                  emoji: { name: '⏮️' },
                  style: ButtonStyle.Secondary,
                  disabled: currentPage === 0
                },
                {
                  type: ComponentType.Button,
                  custom_id: `task_list_prev_${interactionId}`,
                  emoji: { name: '◀️' },
                  style: ButtonStyle.Primary,
                  disabled: currentPage === 0
                },
                {
                  type: ComponentType.Button,
                  custom_id: `task_list_page_${interactionId}`,
                  label: `${currentPage + 1} / ${pages.length}`,
                  style: ButtonStyle.Secondary,
                  disabled: true
                },
                {
                  type: ComponentType.Button,
                  custom_id: `task_list_next_${interactionId}`,
                  emoji: { name: '▶️' },
                  style: ButtonStyle.Primary,
                  disabled: currentPage === pages.length - 1
                },
                {
                  type: ComponentType.Button,
                  custom_id: `task_list_last_${interactionId}`,
                  emoji: { name: '⏭️' },
                  style: ButtonStyle.Secondary,
                  disabled: currentPage === pages.length - 1
                }
              ]
            });
          }

          components.push({
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                custom_id: 'task_refresh_list',
                label: 'Refresh',
                style: ButtonStyle.Secondary,
                emoji: { name: '🔄' }
              },
              {
                type: ComponentType.Button,
                custom_id: 'task_create_new',
                label: 'Create Task',
                style: ButtonStyle.Success,
                emoji: { name: '➕' }
              },
              {
                type: ComponentType.Button,
                custom_id: 'task_list_all',
                label: 'View All',
                style: ButtonStyle.Primary,
                emoji: { name: '📋' }
              },
              {
                type: ComponentType.Button,
                label: 'Open Dashboard',
                style: ButtonStyle.Link,
                url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
              }
            ]
          });

          return components;
        };

        console.log(`[DEBUG] Updating message ${cacheData.messageId} in channel ${cacheData.channelId} with ${pages.length} pages and components`);
        await updateMessage(cacheData.channelId, cacheData.messageId, {
          embeds: [embed],
          components: createComponents(0) as any
        });
        console.log(`[DEBUG] Successfully updated message ${cacheData.messageId} with components`);
      }
    } catch (error) {
      console.error(`[ERROR] Error updating message ${cacheData.messageId} in channel ${cacheData.channelId}:`, error);
      console.error(`[ERROR] Cache data:`, JSON.stringify(cacheData, null, 2));
    }
  }
};