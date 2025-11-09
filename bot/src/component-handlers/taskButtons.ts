import { APIMessageComponentInteraction, InteractionResponseType, APIEmbed, ComponentType, ButtonStyle } from 'discord-api-types/v10';
import { updateResponse, updateMessage } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';


const updateTaskMessage = async (
  interaction: APIMessageComponentInteraction, 
  taskId: string, 
  guildId: string,
  actionType: 'claim' | 'complete' | 'unclaim' | 'approve'
) => {
  if (!interaction.message) {
    throw new Error('No message found in interaction');
  }
  
  let targetResponse: any = null;
  let responseReceived = false;
  const originalUpdateResponse = updateResponse;
  
  const mockUpdateResponse = async (appId: string, token: string, data: any) => {
    targetResponse = data;
    responseReceived = true;
  };
  
  (updateResponse as any) = mockUpdateResponse;
  
  try {
    if (actionType === 'claim') {
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
    } else if (actionType === 'complete') {
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
    } else if (actionType === 'unclaim') {
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
    } else if (actionType === 'approve') {
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
    } else {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    let attempts = 0;
    while (!responseReceived && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    
  } finally {
    (updateResponse as any) = originalUpdateResponse;
  }
  
  if (!targetResponse) {
    throw new Error(`Command handler for ${actionType} did not provide a response after waiting`);
  }
  
  return targetResponse;
};

export const handleTaskButtonInteraction = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const guildId = interaction.guild_id!;
  const userId = interaction.member?.user?.id || interaction.user?.id!;
  
  const embedTitle = interaction.message?.embeds?.[0]?.title || '';
  const isTaskMessage = embedTitle.includes('✦ TASK OVERVIEW ✦') ||
                       embedTitle.includes('✦ TASK CREATED ✦') ||
                       embedTitle.includes('✦ TASK CLAIMED ✦') ||
                       embedTitle.includes('✦ TASK COMPLETED ✦') ||
                       embedTitle.includes('✦ TASK UNCLAIMED ✦') ||
                       embedTitle.includes('✦ TASK APPROVED ✦');

  const taskIdMatch = customId.match(/^task_\w+_(.+)$/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;

  try {
    if (customId.startsWith('task_claim_') && taskId) {
      if (isTaskMessage) {
        try {
          const responseData = await updateTaskMessage(interaction, taskId, guildId, 'claim');
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData
          };
        } catch (error) {
          console.error('Error updating task message:', error);
          const claimInteraction = {
            ...interaction,
            type: 2,
            data: {
              name: 'task-claim',
              options: [{ name: 'task', value: taskId, type: 3 }]
            }
          };
          const { handleTaskClaim } = await import('../command-handlers/taskClaim');
          const result = await handleTaskClaim(claimInteraction as any);
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return result;
        }
      } else {
        const claimInteraction = {
          ...interaction,
          type: 2,
          data: {
            name: 'task-claim',
            options: [{ name: 'task', value: taskId, type: 3 }]
          }
        };
        const { handleTaskClaim } = await import('../command-handlers/taskClaim');
        const result = await handleTaskClaim(claimInteraction as any);
        
        import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });
        
        return result;
      }

    } else if (customId.startsWith('task_complete_') && taskId) {
      if (isTaskMessage) {
        try {
          const responseData = await updateTaskMessage(interaction, taskId, guildId, 'complete');
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData
          };
        } catch (error) {
          console.error('Error updating task message:', error);
          const completeInteraction = {
            ...interaction,
            type: 2,
            data: {
              name: 'task-complete',
              options: [{ name: 'task', value: taskId, type: 3 }]
            }
          };
          const { handleTaskComplete } = await import('../command-handlers/taskComplete');
          const result = await handleTaskComplete(completeInteraction as any);
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return result;
        }
      } else {
        const completeInteraction = {
          ...interaction,
          type: 2,
          data: {
            name: 'task-complete',
            options: [{ name: 'task', value: taskId, type: 3 }]
          }
        };
        const { handleTaskComplete } = await import('../command-handlers/taskComplete');
        const result = await handleTaskComplete(completeInteraction as any);
        
        import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });
        
        return result;
      }

    } else if (customId.startsWith('task_unclaim_') && taskId) {
      if (isTaskMessage) {
        try {
          const responseData = await updateTaskMessage(interaction, taskId, guildId, 'unclaim');
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData
          };
        } catch (error) {
          console.error('Error updating task message:', error);
          const unclaimInteraction = {
            ...interaction,
            type: 2,
            data: {
              name: 'task-unclaim',
              options: [{ name: 'task', value: taskId, type: 3 }]
            }
          };
          const { handleTaskUnclaim } = await import('../command-handlers/taskUnclaim');
          const result = await handleTaskUnclaim(unclaimInteraction as any);
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return result;
        }
      } else {
        const unclaimInteraction = {
          ...interaction,
          type: 2,
          data: {
            name: 'task-unclaim',
            options: [{ name: 'task', value: taskId, type: 3 }]
          }
        };
        const { handleTaskUnclaim } = await import('../command-handlers/taskUnclaim');
        const result = await handleTaskUnclaim(unclaimInteraction as any);
        
        import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });
        
        return result;
      }

    } else if (customId.startsWith('task_approve_') && taskId) {
      if (isTaskMessage) {
        try {
          const responseData = await updateTaskMessage(interaction, taskId, guildId, 'approve');
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData
          };
        } catch (error) {
          console.error('Error updating task message:', error);
          const approveInteraction = {
            ...interaction,
            type: 2,
            data: {
              name: 'task-approve',
              options: [{ name: 'task', value: taskId, type: 3 }]
            }
          };
          const { handleTaskApprove } = await import('../command-handlers/taskApprove');
          const result = await handleTaskApprove(approveInteraction as any);
          
          import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });
          
          return result;
        }
      } else {
        const approveInteraction = {
          ...interaction,
          type: 2,
          data: {
            name: 'task-approve',
            options: [{ name: 'task', value: taskId, type: 3 }]
          }
        };
        const { handleTaskApprove } = await import('../command-handlers/taskApprove');
        const result = await handleTaskApprove(approveInteraction as any);
        
        import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });
        
        return result;
      }

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

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
      const result = await handleTaskList(listInteraction as any);
      return result;

    } else if (customId === 'task_create' || customId === 'task_create_new') {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '💡 **Create New Task**: Use the `/task-create` slash command to create a new task!\n\n📝 *Example: `/task-create title:Update Discord Bot description:Add new features`*',
          flags: 64
        }
      };

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
      const result = await handleTaskList(listInteraction as any);
      
      import('./taskListButton').then(({ refreshTaskListMessages }) => {
        refreshTaskListMessages(guildId).catch(console.error);
      });
      
      return result;

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
      const result = await handleTaskDashboard(dashboardInteraction as any);
      return result;

    } else {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ **Unknown Task Button**: This button interaction is not recognized.\n\n🔧 *Please report this issue to an admin.*',
          flags: 64
        }
      };
    }

  } catch (error) {
    console.error('Error handling task button interaction:', error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ **Error**: Something went wrong while processing your button click.\n\n🔄 *Please try again or use the corresponding slash command.*',
        flags: 64
      }
    };
  }
};