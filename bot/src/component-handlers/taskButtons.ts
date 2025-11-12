import { APIMessageComponentInteraction, InteractionResponseType, ComponentType, ButtonStyle } from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateResponse } from '../adapters/discord-adapter';
import { generateTaskListResponse } from '../command-handlers/taskList';

const performTaskAction = async (
  interaction: APIMessageComponentInteraction, 
  taskId: string, 
  guildId: string,
  actionType: 'claim' | 'complete' | 'unclaim' | 'approve'
) => {
  const userId = interaction.member?.user?.id || interaction.user?.id!;
  
  if (actionType === 'claim') {
    console.log(`Attempting to claim task ${taskId} for user ${userId}`);

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
      console.log(`Task ${taskId} not found`);
      return {
        content: '❌ Task not found.',
      };
    }

    const task = getTaskResult.Item;
    console.log(`Task ${taskId} status: ${task.status}, multipleClaimsAllowed: ${task.multipleClaimsAllowed}, claimedBy: ${task.claimedBy}`);


    const allowsMultiple = task.multipleClaimsAllowed === true;
    if (task.status !== 'pending' && !allowsMultiple) {
      console.log(`Task ${taskId} cannot be claimed - status: ${task.status}, allowsMultiple: ${allowsMultiple}`);
      return {
        content: '❌ This task has already been claimed.',
      };
    }

    console.log(`Claiming task ${taskId} for user ${userId}`);
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

    console.log(`Successfully claimed task ${taskId}`);
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
  
  const now = new Date().toISOString();

  let title = '';
  let color = 0;
  let statusMessage = '';
  let whatNextMessage = '';

  switch (actionType) {
    case 'claim':
      title = '🚀 ✦ TASK CLAIMED ✦';
      color = 0x0099ff; // Blue
      statusMessage = '`🔄 IN PROGRESS`';
      whatNextMessage = '```\n• Work on the task requirements\n• Use /task-complete when finished\n• Add completion notes if needed\n```';
      break;
    case 'complete':
      title = '🎉 ✦ TASK COMPLETED ✦ 🏆';
      color = 0x00ff00; // Green
      statusMessage = '`✅ AWAITING APPROVAL`';
      whatNextMessage = '```\n• Task is ready for admin review\n• Will be removed from board once approved\n• Check dashboard for approval status\n```';
      break;
    case 'unclaim':
      title = '🔄 ✦ TASK UNCLAIMED ✦ 🔄';
      color = 0xff9900; // Orange
      statusMessage = '`📬 PENDING`';
      whatNextMessage = '```\n• Task is back to pending status\n• Anyone can now claim it\n• View task list to see available tasks\n```';
      break;
    case 'approve':
      title = '☑️ ✦ TASK APPROVED ✦ ☑️';
      color = 0x9900ff; // Purple
      statusMessage = '`☑️ APPROVED`';
      whatNextMessage = '```\n• Task has been completed successfully\n• Removed from active task board\n• Contributors can claim new tasks\n```';
      break;
  }

  const priorityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };

  let embed;

  switch (actionType) {
    case 'claim':
      embed = {
        title: title,
        description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n> ${task.description || '*No description provided*'}`,
        fields: [
          {
            name: '📊 **Task Information**',
            value: [
              `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} \`${task.priority.toUpperCase()}\``,
              `**Due Date:** ${task.dueDate ? `📅 \`${task.dueDate}\`` : '`No due date set`'}`,
              `**Status:** ${statusMessage}`
            ].join('\n'),
            inline: false
          },
          {
            name: '👤 **Claimed By**',
            value: `<@${userId}>`,
            inline: true
          },
          {
            name: '⏰ **Claimed At**',
            value: `<t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
            inline: true
          },
          {
            name: '📝 **Next Steps**',
            value: whatNextMessage,
            inline: false
          }
        ],
        color: color,
        footer: {
          text: `Task Management System • Now in progress`,
        },
        timestamp: now
      };
      break;
    case 'complete':
    case 'unclaim':
    case 'approve':
      embed = {
        title: title,
        description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n> ${task.description || '*No description provided*'}`,
        fields: [
          {
            name: '📝 **Completion Notes**',
            value: actionType === 'complete' ? '`No additional notes provided`' : actionType === 'approve' ? '`Task approved successfully`' : '`-`',
            inline: false
          },
          {
            name: `👤 **${actionType === 'complete' ? 'Completed' : actionType === 'unclaim' ? 'Unclaimed' : 'Approved'} By**`,
            value: `<@${userId}>`,
            inline: true
          },
          {
            name: '⏰ **Timestamp**',
            value: `<t:${Math.floor(new Date(now).getTime() / 1000)}:R>`,
            inline: true
          },
          {
            name: '📋 **Status**',
            value: statusMessage,
            inline: true
          },
          {
            name: '⚡ **What\'s Next?**',
            value: whatNextMessage,
            inline: false
          }
        ],
        color: color,
        footer: {
          text: `Task Management System • ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`,
        },
        timestamp: now
      };
      break;
  }

  const multiClaimEnabled = task.multipleClaimsAllowed || false;

  const buttons = [];

  if (task.status === 'pending' && !task.claimedBy) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Claim Task',
      custom_id: `task_claim_${taskId}`,
    });
  } else if (task.status === 'claimed' && multiClaimEnabled) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Claim Task',
      custom_id: `task_claim_${taskId}`,
    });
  }

  if (task.status === 'claimed') {
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

  const buttonsRow = [{
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        custom_id: 'task_list_all',
        label: 'All Tasks',
        style: ButtonStyle.Secondary,
        emoji: { name: '📝' }
      },
      {
        type: ComponentType.Button,
        custom_id: 'task_list_my',
        label: 'My Tasks',
        style: ButtonStyle.Secondary,
        emoji: { name: '👤' }
      },
      {
        type: ComponentType.Button,
        custom_id: 'task_list_completed',
        label: 'View Completed Tasks',
        style: ButtonStyle.Secondary,
        emoji: { name: '📋' }
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Link,
        url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`,
        label: 'Open Dashboard'
      }
    ]
  }];

  return {
    embeds: [embed],
    components: [...components, ...buttonsRow],
  };
};

export const handleTaskButtonInteraction = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const guildId = interaction.guild_id!;
  const userId = interaction.member?.user?.id || interaction.user?.id!;

  console.log(`Handling button interaction: customId=${customId}, guildId=${guildId}, userId=${userId}`);

  const embedTitle = interaction.message?.embeds?.[0]?.title || '';
  console.log(`Checking embed title: "${embedTitle}" for task message detection`);
  const isTaskMessage = embedTitle.includes('✦ TASK') ||
                        embedTitle.includes('🎉 ✦ TASK') ||
                        embedTitle.includes('🔄 ✦ TASK') ||
                        embedTitle.includes('✅ ✦ TASK');
  console.log(`isTaskMessage result: ${isTaskMessage}`);

  const taskIdMatch = customId.match(/^task_\w+_(.+)$/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;

  if (customId === 'task_list_my') {
    console.log('Handling My Tasks navigation button via taskButtons.ts (ephemeral simulated /task-list user filter)');

    const { embeds, components } = await generateTaskListResponse(
      guildId,
      undefined,          // statusFilter
      undefined,          // roleFilter
      userId              // userFilter
    );

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64 
      }
    };
  } else if (customId === 'task_list_completed') {
    console.log('Handling View Completed Tasks navigation button via taskButtons.ts (ephemeral simulated /task-list status:completed)');

    const { embeds, components } = await generateTaskListResponse(
      guildId,
      'completed'         
    );

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64 
      }
    };
  } else if (customId === 'task_list_all') {
    console.log('Handling List All Tasks navigation button via taskButtons.ts (ephemeral simulated /task-list all)');

    const { embeds, components } = await generateTaskListResponse(
      guildId
    );

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
        components,
        flags: 64 
      }
    };
  }

  try {
    console.log(`Handling task button: ${customId}, isTaskMessage: ${isTaskMessage}, taskId: ${taskId}`);

    if (customId.startsWith('task_claim_')) {
      console.log(`Processing claim action for task ${taskId}`);
      if (isTaskMessage) {
        if (!taskId) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Invalid task ID.',
              flags: 64,
            },
          };
        }
        const responseData = await performTaskAction(interaction, taskId, guildId, 'claim');

        if (responseData.content) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: responseData.content,
              flags: 64,
            },
          };
        }

        console.log(`Action button 'claim' completed for task ${taskId}, refreshing task list messages`);
        console.log(`Action button 'complete' completed for task ${taskId}, refreshing task list messages`);
        console.log(`Action button 'unclaim' completed for task ${taskId}, refreshing task list messages`);
        void import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });

        await updateResponse(interaction.application_id, interaction.token, responseData);
        return;
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ This button can only be used on task messages.',
          flags: 64,
        },
      };
    } else if (customId.startsWith('task_complete_')) {
      if (isTaskMessage) {
        if (!taskId) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Invalid task ID.',
              flags: 64,
            },
          };
        }
        const responseData = await performTaskAction(interaction, taskId, guildId, 'complete');

        if (responseData.content) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: responseData.content,
              flags: 64,
            },
          };
        }

        void import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });

        await updateResponse(interaction.application_id, interaction.token, responseData);
        return;
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ This button can only be used on task messages.',
          flags: 64,
        },
      };
    } else if (customId.startsWith('task_unclaim_')) {
      if (isTaskMessage) {
        if (!taskId) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Invalid task ID.',
              flags: 64,
            },
          };
        }
        const responseData = await performTaskAction(interaction, taskId, guildId, 'unclaim');

        if (responseData.content) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: responseData.content,
              flags: 64,
            },
          };
        }

        void import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });

        await updateResponse(interaction.application_id, interaction.token, responseData);
        return;
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ This button can only be used on task messages.',
          flags: 64,
        },
      };
    } else if (customId.startsWith('task_approve_')) {
      console.log(`Entered task_approve_ block for task ${taskId}`);
      console.log(`Processing approve action for task ${taskId}, isTaskMessage: ${isTaskMessage}`);
      if (isTaskMessage) {
        console.log(`Taking isTaskMessage true path for task ${taskId}`);
        const isEphemeral = interaction.message?.flags === 64;
        if (isEphemeral) {
          console.log('Approve button pressed on ephemeral message.');
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: '❌ Approval actions must be performed on public messages.',
              flags: 64,
            },
          };
        }
        console.log('Approving task from individual task embed');
        const responseData = await performTaskAction(interaction, taskId!, guildId, 'approve');
        if (responseData.content) {
          console.log(`Approve failed with error: ${responseData.content}`);
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: responseData.content,
              flags: 64,
            },
          };
        }
        console.log(`Action button 'approve' completed for task ${taskId}, refreshing task list messages`);
        void import('./taskListButton').then(({ refreshTaskListMessages }) => {
          refreshTaskListMessages(guildId).catch(console.error);
        });
        await updateResponse(interaction.application_id, interaction.token, responseData);
        return;
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: '❌ This button can only be used on task messages.',
          flags: 64,
        },
      };
    }
  } catch (err) {
    console.error(`Error handling task button interaction: ${err}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ An error occurred while processing your request.',
        flags: 64,
      },
    };
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: '❌ Unknown button interaction.',
      flags: 64,
    },
  };
};
