import { 
  APIMessageComponentInteraction, 
  ComponentType, 
  ButtonStyle, 
  APIEmbed, 
  InteractionResponseType 
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

interface TaskListCacheData {
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
) => {
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
      const claimedBy = task.claimedBy ? ` - <@${task.claimedBy}>` : '';
      const assignedRole = task.assignedRole ? ` - <@&${task.assignedRole}>` : '';
      const assignedTo = task.assignedTo ? ` - <@${task.assignedTo}>` : '';
      
      return `${priority}${status} **${task.title}**${dueDate}${claimedBy}${assignedRole}${assignedTo}`;
    }).join('\n');

    const embed: APIEmbed = {
      title: `📋 ✦ TASK BOARD${data.filters.status || data.filters.role || data.filters.user ? ' (FILTERED)' : ''} ✦ 📝`,
      description: (() => {
        const filterParts = [];
        if (data.filters.status) filterParts.push(`Status: ${data.filters.status}`);
        if (data.filters.role) filterParts.push(`Role: <@&${data.filters.role}>`);
        if (data.filters.user) filterParts.push(`User: <@${data.filters.user}>`);
        
        const isFiltered = filterParts.length > 0;
        const filterDescription = isFiltered ? ` (${filterParts.join(', ')})` : '';
        
        if (isFiltered) {
          return `Showing ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} matching filters${filterDescription}\n\n${taskList || '`No tasks found matching the current filters.`'}`;
        }
        return taskList || '`No tasks found matching the current filters.`';
      })(),
      color: 0x5865F2,
      fields: [
        {
          name: `📊 **Task Statistics${data.filters.status || data.filters.role || data.filters.user ? ' (Filtered)' : ''}**`,
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
        text: `Page ${pageIndex + 1} of ${pages.length}  •  ${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} displayed`,
      },
      timestamp: new Date().toISOString()
    };

    if (data.filters.status || data.filters.role || data.filters.user) {
      const filterInfo = [];
      if (data.filters.status) filterInfo.push(`Status: ${data.filters.status}`);
      if (data.filters.role) filterInfo.push(`Role: <@&${data.filters.role}>`);
      if (data.filters.user) filterInfo.push(`User: <@${data.filters.user}>`);
      
      embed.fields!.unshift({
        name: '🔍 Active Filters',
        value: filterInfo.join(', '),
        inline: false
      });
    }

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
          custom_id: 'task_create_new',
          label: 'Create Task',
          style: ButtonStyle.Success,
          emoji: { name: '➕' }
        },
        {
          type: ComponentType.Button,
          custom_id: 'task_refresh_list',
          label: 'Refresh',
          style: ButtonStyle.Secondary,
          emoji: { name: '🔄' }
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

  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      embeds: [createTaskEmbed(newPage)],
      components: createComponents(newPage)
    }
  };
};

export const handleTaskListFilterButton = async (
  interaction: APIMessageComponentInteraction,
  customId: string
) => {
  const userId = interaction.member?.user?.id || interaction.user?.id!;
  
  let fakeInteraction: any = {
    ...interaction,
    type: 2,
    data: {
      name: 'task-list',
      options: []
    }
  };

  switch (customId) {
    case 'task_list_all':
      break;
    case 'task_list_my':
      fakeInteraction.data.options = [{ name: 'user', value: userId, type: 6 }];
      break;
    case 'task_list_pending':
      fakeInteraction.data.options = [{ name: 'status', value: 'pending', type: 3 }];
      break;
    case 'task_list_claimed':
      fakeInteraction.data.options = [{ name: 'status', value: 'claimed', type: 3 }];
      break;
    case 'task_list_completed':
      fakeInteraction.data.options = [{ name: 'status', value: 'completed', type: 3 }];
      break;
    case 'task_list_approved':
      fakeInteraction.data.options = [{ name: 'status', value: 'approved', type: 3 }];
      break;
    case 'task_list_available':
      fakeInteraction.data.options = [{ name: 'status', value: 'pending', type: 3 }];
      break;
    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ Unknown task list filter.',
          flags: 64
        }
      };
  }

  const { handleTaskList } = await import('../command-handlers/taskList');
  await handleTaskList(fakeInteraction);

  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: {}
  };
};