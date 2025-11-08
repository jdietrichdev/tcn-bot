import { APIMessageComponentInteraction, InteractionResponseType } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskButtonInteraction = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const guildId = interaction.guild_id!;
  const userId = interaction.member?.user?.id || interaction.user?.id!;

  try {
    await updateResponse(interaction.application_id, interaction.token, {
      content: '⏳ Processing...',
    });

    const taskIdMatch = customId.match(/^task_\w+_(.+)$/);
    const taskId = taskIdMatch ? taskIdMatch[1] : null;

    if (customId.startsWith('task_claim_') && taskId) {
      const claimInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-claim',
          options: [{ name: 'task', value: taskId, type: 3 }]
        }
      };
      const { handleTaskClaim } = await import('../command-handlers/taskClaim');
      await handleTaskClaim(claimInteraction as any);

    } else if (customId.startsWith('task_complete_') && taskId) {
      const completeInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-complete',
          options: [{ name: 'task', value: taskId, type: 3 }]
        }
      };
      const { handleTaskComplete } = await import('../command-handlers/taskComplete');
      await handleTaskComplete(completeInteraction as any);

    } else if (customId.startsWith('task_unclaim_') && taskId) {
      const unclaimInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-unclaim',
          options: [{ name: 'task', value: taskId, type: 3 }]
        }
      };
      const { handleTaskUnclaim } = await import('../command-handlers/taskUnclaim');
      await handleTaskUnclaim(unclaimInteraction as any);

    } else if (customId.startsWith('task_approve_') && taskId) {
      const approveInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-approve',
          options: [{ name: 'task', value: taskId, type: 3 }]
        }
      };
      const { handleTaskApprove } = await import('../command-handlers/taskApprove');
      await handleTaskApprove(approveInteraction as any);

    } else if (customId === 'task_list_all') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: []
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_my') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'user', value: userId, type: 6 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_pending') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'status', value: 'pending', type: 3 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_claimed') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'status', value: 'claimed', type: 3 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_completed') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'status', value: 'completed', type: 3 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_approved') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'status', value: 'approved', type: 3 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_list_available') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: [{ name: 'status', value: 'pending', type: 3 }]
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_create') {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '💡 **Create New Task**: Use the `/task-create` slash command to create a new task!\n\n📝 *Example: `/task-create title:Update Discord Bot description:Add new features`*',
      });

    } else if (customId === 'task_refresh_list') {
      const listInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-list',
          options: []
        }
      };
      const { handleTaskList } = await import('../command-handlers/taskList');
      await handleTaskList(listInteraction as any);

    } else if (customId === 'task_refresh_dashboard') {
      const dashboardInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-dashboard',
          options: []
        }
      };
      const { handleTaskDashboard } = await import('../command-handlers/taskDashboard');
      await handleTaskDashboard(dashboardInteraction as any);

    } else {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ **Unknown Task Button**: This button interaction is not recognized.\n\n🔧 *Please report this issue to an admin.*',
      });
    }

  } catch (error) {
    console.error('Error handling task button interaction:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ **Error**: Something went wrong while processing your button click.\n\n🔄 *Please try again or use the corresponding slash command.*',
    });
  }
};