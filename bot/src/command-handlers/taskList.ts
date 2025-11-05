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
    const taskCounts = {
      pending: allTasks.filter(t => t.status === 'pending').length,
      claimed: allTasks.filter(t => t.status === 'claimed').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      approved: allTasks.filter(t => t.status === 'approved').length,
    };

    if (tasks.length === 0) {
      const noTasksEmbed: APIEmbed = {
        title: '📋 ═══════ TASK LIST ═══════ 📝',
        description: statusFilter 
          ? `No tasks found with status **${statusFilter}**.`
          : 'No tasks found. Create your first task with `/task-create`!',
        color: 0x808080,
        fields: [
          {
            name: '📊 Task Summary',
            value: `🟡 Pending: ${taskCounts.pending}\n🔵 Claimed: ${taskCounts.claimed}\n🟢 Completed: ${taskCounts.completed}\n✅ Approved: ${taskCounts.approved}`,
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
            url: `${process.env.DASHBOARD_URL || 'https://tcn-bot.vercel.app'}/tasks`
          }
        ]
      }];

      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [noTasksEmbed],
        components
      });
      return;
    }

    const displayTasks = tasks.slice(0, 10);
    
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    const statusEmoji = { 
      pending: '🟡', 
      claimed: '🔵', 
      completed: '🟢', 
      approved: '✅' 
    };

    const taskList = displayTasks.map((task: any, index: number) => {
      const priority = priorityEmoji[task.priority as keyof typeof priorityEmoji] || '⚪';
      const status = statusEmoji[task.status as keyof typeof statusEmoji] || '❓';
      const dueDate = task.dueDate ? ` (Due: ${task.dueDate})` : '';
      const claimedBy = task.claimedBy ? ` - <@${task.claimedBy}>` : '';
      
      return `${priority}${status} **${task.title}**${dueDate}${claimedBy}`;
    }).join('\n');

    const embed: APIEmbed = {
      title: '📋 ═══════ TASK LIST ═══════ 📝',
      description: taskList,
      color: 0x5865F2,
      fields: [
        {
          name: '📊 Task Summary',
          value: `🟡 Pending: ${taskCounts.pending}\n🔵 Claimed: ${taskCounts.claimed}\n🟢 Completed: ${taskCounts.completed}\n✅ Approved: ${taskCounts.approved}`,
          inline: true
        },
        {
          name: '📖 Legend',
          value: `🔴 High Priority\n🟡 Medium Priority\n🟢 Low Priority\n\n🟡 Pending\n🔵 Claimed\n🟢 Completed\n✅ Approved`,
          inline: true
        }
      ],
      footer: {
        text: tasks.length > 10 
          ? `Showing 10 of ${tasks.length} tasks. Use dashboard for full list.`
          : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`
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
          custom_id: 'task_refresh_list',
          label: 'Refresh',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '🔄' }
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

  } catch (err) {
    console.error('Failed to list tasks:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to retrieve tasks. Please try again or contact an admin.',
    });
  }
};