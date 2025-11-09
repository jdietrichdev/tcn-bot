import { 
  APIChatInputApplicationCommandInteraction, 
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskDashboard = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = interaction.guild_id!;

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

    const tasks = queryResult.Items || [];
    
    const stats = {
      pending: tasks.filter(t => t.status === 'pending').length,
      claimed: tasks.filter(t => t.status === 'claimed').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      approved: tasks.filter(t => t.status === 'approved').length,
      total: tasks.length,
      highPriority: tasks.filter(t => t.priority === 'high' && t.status !== 'approved').length,
      overdue: tasks.filter(t => {
        if (!t.dueDate || t.status === 'approved') return false;
        return new Date(t.dueDate) < new Date();
      }).length,
    };

    const recentTasks = tasks
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    const statusEmoji = {
      pending: '📬', 
      claimed: '📪',
      completed: '✅',
      approved: '☑️'
    };

    const recentTasksText = recentTasks.length > 0 
      ? recentTasks.map((task: any) => {
          const priority = priorityEmoji[task.priority as keyof typeof priorityEmoji] || '⚪';
          const status = statusEmoji[task.status as keyof typeof statusEmoji] || '❓';
          return `${priority}${status} **${task.title}**`;
        }).join('\n')
      : '*No tasks yet*';

    const embed: APIEmbed = {
      title: '📊 ✦ TASK DASHBOARD ✦ 💻',
      description: `### 🎯 **TCN Task Management System**\n\n` +
                  `> *TCN management platform.*`,
      fields: [
        {
          name: '📈 **Current Board Status**',
          value: [
            `**📋 Total Tasks:** \`${stats.total}\``,
            `**📬 Pending:** \`${stats.pending}\``,
            `**📪 Claimed:** \`${stats.claimed}\``,
            `**✅ Ready for Review:** \`${stats.completed}\``,
            `**☑️ Approved:** \`${stats.approved}\``
          ].join('\n'),
          inline: true
        },
        {
          name: '⚡ **Priority Overview**',
          value: [
            `**🔴 High Priority:** \`${stats.highPriority}\``,
            `**⏰ Overdue Tasks:** \`${stats.overdue}\``,
            `**👀 Needs Approval:** \`${stats.completed}\``,
            '',
            stats.highPriority > 0 || stats.overdue > 0 
              ? '🚨 **Attention Required!**'
              : '✅ **All caught up!**'
          ].join('\n'),
          inline: true
        },
        {
          name: '� **Recent Activity**',
          value: recentTasksText || '`No recent activity`',
          inline: false
        },
        {
          name: '🚀 **Quick Commands**',
          value: [
            '```',
            '/task-create  → Create new task',
            '/task-claim   → Claim available task',
            '/task-list    → View task board',
            '/task-help    → Get command help',
            '```'
          ].join('\n'),
          inline: false
        },
        {
          name: '🌐 **Web Dashboard**',
          value: '```\n• Full task management interface\n• Real-time analytics\n• Advanced filtering options\n```',
          inline: false
        }
      ],
      color: 0x5865F2,
      footer: {
        text: `Task Management System • ${new Date().toLocaleDateString()} • Click below to access full dashboard`,
      },
      timestamp: new Date().toISOString()
    };

    const dashboardUrl = `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks?guild=${guildId}`;
    
    const components = [{
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button as ComponentType.Button,
          label: 'Open Dashboard',
          style: ButtonStyle.Link as ButtonStyle.Link,
          url: dashboardUrl,
          emoji: { name: '🌐' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_create_new',
          label: 'Create Task',
          style: ButtonStyle.Success as ButtonStyle.Success,
          emoji: { name: '➕' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_list_all',
          label: 'View All Tasks',
          style: ButtonStyle.Primary as ButtonStyle.Primary,
          emoji: { name: '📋' }
        },
        {
          type: ComponentType.Button as ComponentType.Button,
          custom_id: 'task_refresh_dashboard',
          label: 'Refresh',
          style: ButtonStyle.Secondary as ButtonStyle.Secondary,
          emoji: { name: '🔄' }
        }
      ]
    }];

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components
    });

  } catch (err) {
    console.error('Failed to show task dashboard:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to load task dashboard. Please try again or contact an admin.',
    });
  }
};