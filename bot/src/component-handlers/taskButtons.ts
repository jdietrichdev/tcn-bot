import { APIChatInputApplicationCommandInteraction, APIMessageComponentInteraction, InteractionResponseType, ComponentType, ButtonStyle } from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateResponse, sendFollowupMessage } from '../adapters/discord-adapter';
import { generateTaskListResponse } from '../command-handlers/taskList';

export const performTaskAction = async (
  interaction: APIMessageComponentInteraction | APIChatInputApplicationCommandInteraction, 
  taskId: string, 
  guildId: string,
  actionType: 'claim' | 'complete' | 'unclaim' | 'approve',
  notes?: string
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
    const allowsMultiple = Array.isArray(task.assignedRoleIds) && task.assignedRoleIds.length > 0;

    const member = interaction.member;
    const memberRoles: string[] = Array.isArray(member?.roles) ? (member!.roles as string[]) : [];

    const assignedUsers: string[] = Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [];
    const assignedRoles: string[] = Array.isArray(task.assignedRoleIds) ? task.assignedRoleIds : [];

    let isEligible = false;
    if (assignedUsers.length > 0 && assignedUsers.includes(userId)) {
      isEligible = true;
    }
    if (assignedRoles.length > 0 && memberRoles.some((r) => assignedRoles.includes(r))) {
      isEligible = true;
    }

    if ((assignedUsers.length > 0 || assignedRoles.length > 0) && !isEligible) {
      console.log(`User ${userId} is not eligible to claim task ${taskId}`);
      return {
        content: '❌ You are not assigned to this task or do not have the required role.',
      };
    }

    if (!allowsMultiple) {
      if (task.status !== 'pending') {
        console.log(`Task ${taskId} cannot be claimed - status: ${task.status}`);
        return {
          content: '❌ This task has already been claimed.',
        };
      }

      console.log(`Claiming task ${taskId} for user ${userId} (single-claim mode)`);
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
      const existingClaimants: string[] = Array.isArray(task.claimedByUsers)
        ? task.claimedByUsers
        : (task.claimedBy ? [task.claimedBy] : []);

      if (existingClaimants.includes(userId)) {
        console.log(`User ${userId} already claimed multi-claim task ${taskId}`);
        return {
          content: '✅ You have already claimed this task.',
        };
      }

      const updatedClaimants = [...existingClaimants, userId];

      const claimantRoles = task.claimantRoles || {};
      claimantRoles[userId] = memberRoles;

      console.log(`Adding user ${userId} to claimedByUsers for multi-claim task ${taskId}`);
      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: `task#${taskId}`,
          },
          UpdateExpression: 'SET #status = :status, claimedByUsers = :claimedByUsers, claimantRoles = :claimantRoles, claimedAt = if_not_exists(claimedAt, :claimedAt)',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'claimed',
            ':claimedByUsers': updatedClaimants,
            ':claimantRoles': claimantRoles,
            ':claimedAt': new Date().toISOString(),
          },
        })
      );
    }

    console.log(`Successfully claimed task ${taskId}`);
  } else if (actionType === 'complete') {
    const getTaskBeforeComplete = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    if (!getTaskBeforeComplete.Item) {
      return {
        content: '❌ Task not found.',
      };
    }

    const taskBefore = getTaskBeforeComplete.Item;
    const allowsMultiple = taskBefore.multipleClaimsAllowed === true;
    const claimedByUsers: string[] = Array.isArray(taskBefore.claimedByUsers)
      ? taskBefore.claimedByUsers
      : (taskBefore.claimedBy ? [taskBefore.claimedBy] : []);

    const assignedRoles: string[] = Array.isArray(taskBefore.assignedRoleIds)
      ? taskBefore.assignedRoleIds
      : (taskBefore.assignedRole ? [taskBefore.assignedRole] : []);

    if (allowsMultiple) {
      if (!claimedByUsers.includes(userId)) {
        return {
          content: '❌ You must claim this task before marking it complete.',
        };
      }

      const existingCompleted: string[] = Array.isArray(taskBefore.completedByUsers)
        ? taskBefore.completedByUsers
        : [];

      if (existingCompleted.includes(userId)) {
        return {
          content: '✅ You have already marked your part as complete.',
        };
      }

      const updatedCompleted = [...existingCompleted, userId];

     
      const isSingleRoleTask = assignedRoles.length === 1 && (!taskBefore.assignedUserIds || taskBefore.assignedUserIds.length === 0);
      const minimumClaimantsMet = isSingleRoleTask ? true : claimedByUsers.length >= 2;

      const allClaimantsFinished = claimedByUsers.length > 0 &&
        claimedByUsers.every((id) => updatedCompleted.includes(id));

      let allDemographicsRepresented = true;
      let missingRoles: string[] = [];

      if (assignedRoles.length > 0) {
        const completerRoles = new Set(updatedCompleted.flatMap(id => taskBefore.claimantRoles?.[id] || []));
        allDemographicsRepresented = assignedRoles.every(roleId => completerRoles.has(roleId));
        if (!allDemographicsRepresented) {
          missingRoles = assignedRoles.filter(roleId => !completerRoles.has(roleId));
        }
      }

      const isFullyComplete = minimumClaimantsMet && allClaimantsFinished && allDemographicsRepresented;
      if (isFullyComplete) {
        await dynamoDbClient.send(
          new UpdateCommand({
            TableName: 'BotTable',
            Key: {
              pk: guildId,
              sk: `task#${taskId}`,
            },
            UpdateExpression:
              'SET #status = :status, completedAt = :completedAt, completedByUsers = :completedByUsers',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':completedAt': new Date().toISOString(),
              ':completedByUsers': updatedCompleted,
            },
          })
        );
      } else {
        await dynamoDbClient.send(
          new UpdateCommand({
            TableName: 'BotTable',
            Key: {
              pk: guildId,
              sk: `task#${taskId}`,
            },
            UpdateExpression:
              'SET #status = :status, completedByUsers = :completedByUsers',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'partially_completed',
              ':completedByUsers': updatedCompleted,
            },
          })
        );
      }
    } else {
      await dynamoDbClient.send(
        new UpdateCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: `task#${taskId}`,
          },
          UpdateExpression: 'SET #status = :status, completedAt = :completedAt, completedBy = :completedBy',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'completed',
            ':completedAt': new Date().toISOString(),
            ':completedBy': userId,
          },
        })
      );
    }
  } else if (actionType === 'unclaim') {
    const getTaskBeforeUnclaim = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: { pk: guildId, sk: `task#${taskId}` },
      })
    );

    if (!getTaskBeforeUnclaim.Item) {
      return { content: '❌ Task not found.' };
    }

    const taskBefore = getTaskBeforeUnclaim.Item;
    const allowsMultiple = taskBefore.multipleClaimsAllowed === true;

    if (allowsMultiple) {
      const existingClaimants: string[] = Array.isArray(taskBefore.claimedByUsers) ? taskBefore.claimedByUsers : [];
      const existingCompleted: string[] = Array.isArray(taskBefore.completedByUsers) ? taskBefore.completedByUsers : [];

      if (!existingClaimants.includes(userId)) {
        return { content: '❌ You have not claimed this task.' };
      }

      const updatedClaimants = existingClaimants.filter(id => id !== userId);
      const updatedCompleted = existingCompleted.filter(id => id !== userId);

      const updateParams: any = {
        TableName: 'BotTable',
        Key: { pk: guildId, sk: `task#${taskId}` },
        UpdateExpression: 'SET claimedByUsers = :claimedByUsers, completedByUsers = :completedByUsers',
        ExpressionAttributeValues: {
          ':claimedByUsers': updatedClaimants,
          ':completedByUsers': updatedCompleted,
        },
      };

      if (updatedClaimants.length === 0) {
        updateParams.UpdateExpression += ', #status = :status REMOVE claimedAt';
        updateParams.ExpressionAttributeNames = { '#status': 'status' };
        updateParams.ExpressionAttributeValues[':status'] = 'pending';
      }

      await dynamoDbClient.send(new UpdateCommand(updateParams));
    } else {
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
    }
  } else if (actionType === 'approve') {
    const getTaskBeforeApprove = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    if (!getTaskBeforeApprove.Item) {
      return {
        content: '❌ Task not found.',
      };
    }

    const taskBefore = getTaskBeforeApprove.Item;

    if (taskBefore.status === 'partially_completed') {
      return {
        content: '❌ This task is only partially completed and cannot be approved yet.',
      };
    }

    if (taskBefore.status !== 'completed') {
      return {
        content: '❌ Only tasks that are fully completed can be approved.',
      };
    }

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

  const multiClaimEnabled = task.multipleClaimsAllowed === true;
  const claimedByUsers: string[] = Array.isArray(task.claimedByUsers)
    ? task.claimedByUsers
    : (task.claimedBy ? [task.claimedBy] : []);
  const completedByUsers: string[] = Array.isArray(task.completedByUsers)
    ? task.completedByUsers
    : [];

  const multiClaimSummary =
    multiClaimEnabled && claimedByUsers.length > 0
      ? `\n**👥 Multi-Claim:** \`${completedByUsers.length}/${claimedByUsers.length}\` contributors completed`
      : '';

  let title = '';
  let color = 0;
  let statusMessage = '';
  let whatNextMessage = '';

  switch (actionType) {
    case 'claim':
      title = '🚀 ✦ TASK CLAIMED ✦';
      color = 0x0099ff; 
      statusMessage = '`🔄 IN PROGRESS`';
      whatNextMessage = '```\n• Work on the task requirements\n• Use /task-complete when finished\n• Add completion notes if needed\n```';
      break;
    case 'complete':
      title = '🎉 ✦ TASK COMPLETED ✦ 🏆';
      color = 0x00ff00; 
      statusMessage = '`✅ AWAITING APPROVAL`';
      whatNextMessage = '```\n• Task is ready for admin review\n• Will be removed from board once approved\n• Check dashboard for approval status\n```';
      break;
    case 'unclaim':
      title = '🔄 ✦ TASK UNCLAIMED ✦ 🔄';
      color = 0xff9900; 
      statusMessage = '`📬 PENDING`';
      whatNextMessage = '```\n• Task is back to pending status\n• Anyone can now claim it\n• View task list to see available tasks\n```';
      break;
    case 'approve':
      title = '☑️ ✦ TASK APPROVED ✦ ☑️';
      color = 0x9900ff; 
      statusMessage = '`☑️ APPROVED`';
      whatNextMessage = '```\n• Task has been completed successfully\n• Removed from active task board\n• Contributors can claim new tasks\n```';
      break;
  }

  const isPartiallyComplete = task.status === 'partially_completed';

  if (actionType === 'complete' && isPartiallyComplete) {
    title = '⏳ ✦ TASK PARTIALLY COMPLETED ✦';
    color = 0xf2c744; // Yellow
    statusMessage = '`⏳ PARTIALLY COMPLETED`';
    whatNextMessage = '```\n• Waiting for other contributors to complete their part.\n• Task cannot be approved yet.\n```';
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
        description:
          `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
          `> ${task.description || '*No description provided*'}` +
          multiClaimSummary,
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
            name: multiClaimEnabled ? '👥 **Claimed By (All Contributors)**' : '👤 **Claimed By**',
            value: multiClaimEnabled && claimedByUsers.length > 0
              ? claimedByUsers.map((id) => `<@${id}>`).join(', ')
              : `<@${userId}>`,
            inline: false
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
        description:
          `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
          `> ${task.description || '*No description provided*'}` +
          multiClaimSummary,
        fields: [
          {
            name: '📝 **Completion Notes**',
            value: actionType === 'complete' ? '`No additional notes provided`' : actionType === 'approve' ? '`Task approved successfully`' : '`-`',
            inline: false
          },
          {
            name: multiClaimEnabled
              ? '✅ **Completed By (All Contributors)**'
              : `👤 **${actionType === 'complete' ? 'Completed' : actionType === 'unclaim' ? 'Unclaimed' : 'Approved'} By**`,
            value: multiClaimEnabled && completedByUsers.length > 0
              ? completedByUsers.map((id: string) => `<@${id}>`).join(', ')
              : `<@${userId}>`,
            inline: false
          },
          ...(multiClaimEnabled && claimedByUsers.length > 0
            ? [{
                name: '👥 **All Claimants**',
                value: claimedByUsers.map((id) => `<@${id}>`).join(', '),
                inline: false
              }]
            : []),
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


  const buttons: any[] = [];

  
  if (
    (task.status === 'pending' && !task.claimedBy && !multiClaimEnabled) ||
    (multiClaimEnabled && (task.status === 'pending' || task.status === 'claimed'))
  ) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Claim Task',
      custom_id: `task_claim_${taskId}`,
    });
  }

  
  if (task.status === 'claimed' || task.status === 'partially_completed') {
    const isSingleClaimOwner = !multiClaimEnabled && task.claimedBy === userId;
    const isMultiClaimParticipant = multiClaimEnabled && claimedByUsers.includes(userId);

    if (isSingleClaimOwner || isMultiClaimParticipant) {
      buttons.push({
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: 'Mark Complete',
        custom_id: `task_complete_${taskId}`,
      });
    }

   
    if (isSingleClaimOwner || isMultiClaimParticipant) {
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
                        embedTitle.includes('✅ ✦ TASK') ||
                        embedTitle.includes('🛡️ ✦ ADMIN TASK UNCLAIM ✦');
  console.log(`isTaskMessage result: ${isTaskMessage}`);

  const taskIdMatch = customId.match(/^task_\w+_(.+)$/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;
   
  if (customId === 'task_list_all') {
    console.log('handleTaskButtonInteraction: generating /task-list (all) view from button');

    const { embeds, components } = await generateTaskListResponse(
      guildId,
      undefined,   // any status
      undefined,   // any role
      undefined,   // any user
      interaction.id
    );

    try {
      console.log('Updating response with payload:', JSON.stringify({ embeds, components }, null, 2));
      await updateResponse(interaction.application_id, interaction.token, {
        embeds,
        components,
      });
    } catch (err) {
      const error = err as { statusCode?: number; reason?: string };
      if (error.statusCode === 404 && error.reason === 'Unknown Webhook') {
        console.warn('Interaction token expired. Sending a new message instead.');
        await sendFollowupMessage(interaction.application_id, interaction.token, {
          content: '⚠️ Interaction expired. Here is the updated task list:',
          embeds,
          components,
        });
      } else {
        console.error('Failed to update response:', error);
        console.error('Payload details:', JSON.stringify({ embeds, components }, null, 2));
        throw error;
      }
    }

    return;
  }

  if (customId === 'task_list_my') {
    console.log('handleTaskButtonInteraction: generating /task-list (my tasks) view from button');

    const { embeds, components } = await generateTaskListResponse(
      guildId,
      undefined,   // any status
      undefined,   // any role
      userId,      // filter by clicking user
      interaction.id
    );

    await updateResponse(interaction.application_id, interaction.token, {
      embeds,
      components,
    });

    return;
  }

  if (customId === 'task_list_completed') {
    console.log('handleTaskButtonInteraction: generating /task-list (completed) view from button');

    const { embeds, components } = await generateTaskListResponse(
      guildId,
      'completed', // only completed tasks
      undefined,
      undefined,
      interaction.id
    );

    await updateResponse(interaction.application_id, interaction.token, {
      embeds,
      components,
    });

    return;
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
