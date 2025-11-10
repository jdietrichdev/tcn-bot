import { APIMessageComponentInteraction, InteractionResponseType, ComponentType, ButtonStyle } from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const performTaskAction = async (
  interaction: APIMessageComponentInteraction, 
  taskId: string, 
  guildId: string,
  actionType: 'claim' | 'complete' | 'unclaim' | 'approve'
) => {
  const userId = interaction.member?.user?.id || interaction.user?.id!;
  
  if (actionType === 'claim') {
    const getTaskResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    if (!getTaskResult.Item) {
      return {
        content: '❌ Task not found.',
      };
    }

    const task = getTaskResult.Item;
    const canClaim = !(task.status === 'claimed' && task.claimedBy && !task.multipleClaimsAllowed);

    if (canClaim) {
      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: `task#${taskId}`,
          },
          UpdateExpression: 'SET #status = :status, claimedBy = :claimedBy, claimedAt = :claimedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'claimed',
            ':claimedBy': userId,
            ':claimedAt': new Date().toISOString(),
          },
        })
      );
    } else {
      return {
        content: '❌ This task has already been claimed.',
      };
    }
  } else if (actionType === 'complete') {
    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':completedAt': new Date().toISOString(),
        },
      })
    );
  } else if (actionType === 'unclaim') {
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
  } else if (actionType === 'approve') {
    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET #status = :status, approvedAt = :approvedAt, approvedBy = :approvedBy',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'approved',
          ':approvedAt': new Date().toISOString(),
          ':approvedBy': userId,
        },
      })
    );
  }

  const getTaskResult = await dynamoDbClient.send(
    new GetCommand({
      TableName: 'BotTable',
      Key: {
  pk: guildId,
        sk: `task#${taskId}`,
      },
    })
  );

  if (!getTaskResult.Item) {
    return {
      content: '❌ Task not found.',
    };
  }

  const task = getTaskResult.Item;
  
  let title = '';
  let color = 0;
  
  switch (actionType) {
    case 'claim':
      title = '✦ TASK CLAIMED ✦';
      color = 0x00FF00; // Green
      break;
    case 'complete':
      title = '✦ TASK COMPLETED ✦';
      color = 0x0099FF; // Blue
      break;
    case 'unclaim':
      title = '✦ TASK UNCLAIMED ✦';
      color = 0xFF9900; // Orange
      break;
    case 'approve':
      title = '✦ TASK APPROVED ✦';
      color = 0x9900FF; // Purple
      break;
  }

  const roleDisplay = task.assignedRole ? `<@&${task.assignedRole}>` : 'Any';
  const userDisplay = task.assignedUser ? `<@${task.assignedUser}>` : 'Anyone';
  const claimedDisplay = task.claimedBy ? `<@${task.claimedBy}>` : 'None';
  const multiClaimEnabled = task.multipleClaimsAllowed || false;

  const embed = {
    title: title,
    color: color,
    fields: [
      {
        name: '📋 Task Details',
        value: `**Title:** ${task.title}\n**Description:** ${task.description || 'No description provided'}`,
        inline: false,
      },
      {
        name: '👥 Assignment Details',
        value: `**Assigned Role:** ${roleDisplay}\n**Assigned User:** ${userDisplay}\n**Claimed By:** ${claimedDisplay}`,
        inline: false,
      },
      {
        name: '📊 Status Information',
        value: `**Status:** \`${task.status || 'pending'}\`\n**Priority:** \`${task.priority || 'normal'}\`\n**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:f>`,
        inline: false,
      },
    ],
    footer: {
      text: `Task ID: ${taskId} | Multiple Claims: ${multiClaimEnabled ? 'Enabled' : 'Disabled'}`,
    },
  };

  const buttons = [];
  
  if (task.status === 'pending' && !task.claimedBy) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Claim Task',
      custom_id: `task_claim_${taskId}`,
    });
  } else if (task.status === 'claimed') {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Mark Complete',
      custom_id: `task_complete_${taskId}`,
    });
    
    if (task.claimedBy === userId || multiClaimEnabled) {
      buttons.push({
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: 'Unclaim',
        custom_id: `task_unclaim_${taskId}`,
      });
    }
  } else if (task.status === 'completed') {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Approve',
      custom_id: `task_approve_${taskId}`,
    });
  }

  const components = buttons.length > 0 ? [{
    type: ComponentType.ActionRow,
    components: buttons,
  }] as any : [];

  return {
    embeds: [embed],
    components: components,
  };
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

  if (!taskId) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ Invalid task ID.',
        flags: 64,
      },
    };
  }

  try {
    if (customId.startsWith('task_claim_')) {
      if (isTaskMessage) {
        try {
          const responseData = await performTaskAction(interaction, taskId, guildId, 'claim');
          void import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });

          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData,
          };
        } catch (error) {
          console.error('Error in claim operation:', error);
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Failed to claim task. Please try again.',
              flags: 64,
            },
          };
        }
      }

      const claimInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-claim',
          options: [{ name: 'task', value: taskId, type: 3 }],
        },
      };
      const { handleTaskClaim } = await import('../command-handlers/taskClaim');
      return await handleTaskClaim(claimInteraction as any);
    } else if (customId.startsWith('task_complete_')) {
      if (isTaskMessage) {
        try {
          const responseData = await performTaskAction(interaction, taskId, guildId, 'complete');
          void import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });

          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData,
          };
        } catch (error) {
          console.error('Error in complete operation:', error);
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Failed to complete task. Please try again.',
              flags: 64,
            },
          };
        }
      }

      const completeInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-complete',
          options: [{ name: 'task', value: taskId, type: 3 }],
        },
      };
      const { handleTaskComplete } = await import('../command-handlers/taskComplete');
      return await handleTaskComplete(completeInteraction as any);
    } else if (customId.startsWith('task_unclaim_')) {
      if (isTaskMessage) {
        try {
          const responseData = await performTaskAction(interaction, taskId, guildId, 'unclaim');
          void import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });

          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData,
          };
        } catch (error) {
          console.error('Error in unclaim operation:', error);
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Failed to unclaim task. Please try again.',
              flags: 64,
            },
          };
        }
      }

      const unclaimInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-unclaim',
          options: [{ name: 'task', value: taskId, type: 3 }],
        },
      };
      const { handleTaskUnclaim } = await import('../command-handlers/taskUnclaim');
      return await handleTaskUnclaim(unclaimInteraction as any);
    } else if (customId.startsWith('task_approve_')) {
      if (isTaskMessage) {
        try {
          const responseData = await performTaskAction(interaction, taskId, guildId, 'approve');
          void import('./taskListButton').then(({ refreshTaskListMessages }) => {
            refreshTaskListMessages(guildId).catch(console.error);
          });

          return {
            type: InteractionResponseType.UpdateMessage,
            data: responseData,
          };
        } catch (error) {
          console.error('Error in approve operation:', error);
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Failed to approve task. Please try again.',
              flags: 64,
            },
          };
        }
      }

      const approveInteraction = {
        ...interaction,
        type: 2,
        data: {
          name: 'task-approve',
          options: [{ name: 'task', value: taskId, type: 3 }],
        },
      };
      const { handleTaskApprove } = await import('../command-handlers/taskApprove');
      return await handleTaskApprove(approveInteraction as any);
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ Unknown button interaction.',
        flags: 64,
      },
    };
  } catch (error) {
    console.error('Error handling task button interaction:', error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ An error occurred while processing your request.',
        flags: 64,
      },
    };
  }
};