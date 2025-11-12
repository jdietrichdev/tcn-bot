import { APIMessageComponentInteraction, InteractionResponseType, ComponentType, ButtonStyle, APIEmbed } from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateResponse } from '../adapters/discord-adapter';
import { generateTaskListResponse } from '../command-handlers/taskList';

const performTaskAction = async (
  interaction: APIMessageComponentInteraction,
  taskId: string,
  guildId: string,
  actionType: 'claim' | 'complete' | 'unclaim' | 'approve'
): Promise<{ success: boolean; error?: string }> => {
  const userId = interaction.member?.user?.id || interaction.user?.id!;

  try {
    if (actionType === 'claim') {
      console.log(`[DEBUG] Attempting to claim task ${taskId} for user ${userId}`);

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
        console.log(`[DEBUG] Task ${taskId} not found`);
        return { success: false, error: '❌ Task not found.' };
      }

      const task = getTaskResult.Item;
      console.log(`[DEBUG] Task ${taskId} status: ${task.status}, multipleClaimsAllowed: ${task.multipleClaimsAllowed}, claimedBy: ${task.claimedBy}`);

      const allowsMultiple = task.multipleClaimsAllowed === true;
      if (task.status !== 'pending' && !allowsMultiple) {
        console.log(`[DEBUG] Task ${taskId} cannot be claimed - status: ${task.status}, allowsMultiple: ${allowsMultiple}`);
        return { success: false, error: '❌ This task has already been claimed.' };
      }

      console.log(`[DEBUG] Claiming task ${taskId} for user ${userId}`);
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

      console.log(`[DEBUG] Successfully claimed task ${taskId}`);
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

    return { success: true };
  } catch (err) {
    console.error(`[ERROR] Error performing task action ${actionType} for task ${taskId}: ${err}`);
    return { success: false, error: '❌ An error occurred while processing your request.' };
  }
};

const formatAssignmentDetails = (task: any) => {
  let roleDisplay = '`Anyone can claim`';
  if (task.assignedRoleIds && Array.isArray(task.assignedRoleIds) && task.assignedRoleIds.length > 0) {
    const roleList = task.assignedRoleIds.map((id: string) => `<@&${id}>`).join(', ');
    roleDisplay = roleList;
  } else if (task.assignedRole) {
    roleDisplay = `<@&${task.assignedRole}>`;
  }

  let userDisplay = '`Not assigned to specific user`';
  if (task.assignedUserIds && Array.isArray(task.assignedUserIds) && task.assignedUserIds.length > 0) {
    const userList = task.assignedUserIds.map((id: string) => `<@${id}>`).join(', ');
    userDisplay = userList;
  } else if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
    const userList = task.assignedTo.map((id: string) => `<@${id}>`).join(', ');
    userDisplay = userList;
  } else if (task.assignedTo) {
    userDisplay = `<@${task.assignedTo}>`;
  }

  let claimedDisplay = '`No one`';
  if (task.claimedBy) {
    if (Array.isArray(task.claimedBy)) {
      const claimedList = task.claimedBy.map((id: string) => `<@${id}>`).join(', ');
      claimedDisplay = claimedList;
    } else {
      claimedDisplay = `<@${task.claimedBy}>`;
    }
  }

  return { roleDisplay, userDisplay, claimedDisplay };
};

const generateTaskOverviewEmbed = async (taskId: string, guildId: string, userId: string, interaction: APIMessageComponentInteraction): Promise<{ embed: APIEmbed; components: any[] }> => {
  const getResult = await dynamoDbClient.send(
    new GetCommand({
      TableName: 'BotTable',
      Key: {
        pk: guildId,
        sk: `task#${taskId}`,
      },
    })
  );

  const task = getResult.Item;
  if (!task) {
    throw new Error('Task not found');
  }

  const priorityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };

  const statusEmoji = {
    pending: '📬',
    claimed: '📪',
    completed: '✅',
    approved: '☑️'
  };

  const statusText = {
    pending: 'PENDING',
    claimed: 'CLAIMED',
    completed: 'READY FOR REVIEW',
    approved: 'APPROVED'
  };

  const createdDate = new Date(task.createdAt);
  const claimedDate = task.claimedAt ? new Date(task.claimedAt) : null;
  const completedDate = task.completedAt ? new Date(task.completedAt) : null;
  const approvedDate = task.approvedAt ? new Date(task.approvedAt) : null;

  const embed: APIEmbed = {
    title: '🔍 ✦ TASK OVERVIEW ✦',
    description: `### ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} **${task.title}**\n\n` +
                `> ${task.description || '*No description provided*'}`,
    color: task.priority === 'high' ? 0xff4444 : task.priority === 'medium' ? 0xffaa00 : 0x00ff00,
    fields: [
      {
        name: '📊 **Task Information**',
        value: [
          `**Priority:** ${priorityEmoji[task.priority as keyof typeof priorityEmoji]} \`${task.priority.toUpperCase()}\``,
          `**Status:** ${statusEmoji[task.status as keyof typeof statusEmoji]} \`${statusText[task.status as keyof typeof statusText]}\``,
          `**Due Date:** ${task.dueDate ? `📅 \`${task.dueDate}\`` : '`No due date set`'}`,
        ].join('\n'),
        inline: false
      },
      {
        name: '👥 **Assignment & Access**',
        value: [
          `**Assigned Role:** ${formatAssignmentDetails(task).roleDisplay}`,
          `**Assigned User:** ${formatAssignmentDetails(task).userDisplay}`,
          `**Currently Claimed:** ${formatAssignmentDetails(task).claimedDisplay}`,
        ].join('\n'),
        inline: false
      },
      {
        name: '📅 **Timeline**',
        value: [
          `**Created:** <t:${Math.floor(createdDate.getTime() / 1000)}:F> by <@${task.createdBy}>`,
          claimedDate ? `**Claimed:** <t:${Math.floor(claimedDate.getTime() / 1000)}:F>` : '',
          completedDate ? `**Completed:** <t:${Math.floor(completedDate.getTime() / 1000)}:F>` : '',
          approvedDate ? `**Approved:** <t:${Math.floor(approvedDate.getTime() / 1000)}:F>` : '',
        ].filter(Boolean).join('\n'),
        inline: false
      }
    ],
    footer: {
      text: `Task Management System • ID: ${task.taskId}`,
    },
    timestamp: new Date().toISOString()
  };

  if (task.unclaimedByAdmin || task.assignedBy) {
    const historyItems = [];
    if (task.assignedBy) {
      historyItems.push(`**Assigned:** By <@${task.assignedBy}> ${task.assignedAt ? `<t:${Math.floor(new Date(task.assignedAt).getTime() / 1000)}:R>` : ''}`);
    }
    if (task.unclaimedByAdmin) {
      historyItems.push(`**Force Unclaimed:** By <@${task.unclaimedByAdmin}> ${task.unclaimedAt ? `<t:${Math.floor(new Date(task.unclaimedAt).getTime() / 1000)}:R>` : ''}`);
    }

    if (historyItems.length > 0) {
      embed.fields!.push({
        name: '📜 **Task History**',
        value: historyItems.join('\n'),
        inline: false
      });
    }
  }

  const allowsMultipleClaims = (task.assignedRoleIds && task.assignedRoleIds.length > 0) ||
                              (task.assignedUserIds && task.assignedUserIds.length > 0) ||
                              task.assignedRole;

  let hasClaimPermission = true;
  if (task.assignedRoleIds && task.assignedRoleIds.length > 0) {
    hasClaimPermission = task.assignedRoleIds.some((roleId: string) =>
      (interaction.member?.roles || []).includes(roleId)
    );
  } else if (task.assignedUserIds && task.assignedUserIds.length > 0) {
    hasClaimPermission = task.assignedUserIds.includes(userId);
  } else if (task.assignedRole) {
    hasClaimPermission = (interaction.member?.roles || []).includes(task.assignedRole);
  } else if (task.assignedTo) {
    hasClaimPermission = task.assignedTo === userId;
  }

  let hasUserClaimed = false;
  if (allowsMultipleClaims && task.claimedBy) {
    const claimedByArray = Array.isArray(task.claimedBy) ? task.claimedBy : [task.claimedBy];
    hasUserClaimed = claimedByArray.includes(userId);
  }

  const canClaim = hasClaimPermission && (
    (task.status === 'pending') ||
    (allowsMultipleClaims && task.status === 'claimed' && !hasUserClaimed)
  );

  const canUnclaim = (task.status === 'claimed') && (
    (allowsMultipleClaims && hasUserClaimed) ||
    (!allowsMultipleClaims && task.claimedBy === userId)
  );

  const canComplete = (task.status === 'claimed') && (
    (allowsMultipleClaims && hasUserClaimed) ||
    (!allowsMultipleClaims && task.claimedBy === userId)
  );

  const components = [];

  const actionButtons = [];

  if (canClaim) {
    actionButtons.push({
      type: ComponentType.Button as ComponentType.Button,
      custom_id: `task_claim_${taskId}`,
      label: 'Claim Task',
      style: ButtonStyle.Success as ButtonStyle.Success,
      emoji: { name: '✋' }
    });
  }

  if (canUnclaim) {
    actionButtons.push({
      type: ComponentType.Button as ComponentType.Button,
      custom_id: `task_unclaim_${taskId}`,
      label: 'Unclaim Task',
      style: ButtonStyle.Danger as ButtonStyle.Danger,
      emoji: { name: '❌' }
    });
  }

  if (canComplete) {
    actionButtons.push({
      type: ComponentType.Button as ComponentType.Button,
      custom_id: `task_complete_${taskId}`,
      label: 'Mark Complete',
      style: ButtonStyle.Primary as ButtonStyle.Primary,
      emoji: { name: '✅' }
    });
  }

  const navButtons = [
    {
      type: ComponentType.Button as ComponentType.Button,
      custom_id: 'task_list_all',
      label: 'View All Tasks',
      style: ButtonStyle.Secondary as ButtonStyle.Secondary,
      emoji: { name: '📋' }
    },
    {
      type: ComponentType.Button as ComponentType.Button,
      label: 'Open Dashboard',
      style: ButtonStyle.Link as ButtonStyle.Link,
      url: `${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks`
    }
  ];

  if (actionButtons.length > 0) {
    components.push({
      type: ComponentType.ActionRow as ComponentType.ActionRow,
      components: actionButtons
    });
  }

  components.push({
    type: ComponentType.ActionRow as ComponentType.ActionRow,
    components: navButtons
  });

  return { embed, components };
};

export const handleTaskButtonInteraction = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const guildId = interaction.guild_id!;
  const userId = interaction.member?.user?.id || interaction.user?.id!;
  const isEphemeral = interaction.message?.flags === 64;

  console.log(`[DEBUG] Handling button interaction: customId=${customId}, guildId=${guildId}, userId=${userId}, isEphemeral=${isEphemeral}`);
  console.log(`[DEBUG] Message embed count: ${interaction.message?.embeds?.length || 0}`);
  console.log(`[DEBUG] Message component count: ${interaction.message?.components?.length || 0}`);

  // Handle action buttons - perform action then return ephemeral task list
  const taskIdMatch = customId.match(/^task_\w+_(.+)$/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;

  console.log(`[DEBUG] Extracted taskId: ${taskId} from customId: ${customId}`);

  if (!taskId) {
    console.log(`[DEBUG] No valid taskId found in customId: ${customId}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ Invalid task ID.',
        flags: 64,
      },
    };
  }

  let actionType: 'claim' | 'complete' | 'unclaim' | 'approve' | null = null;
  if (customId.startsWith('task_claim_')) {
    actionType = 'claim';
  } else if (customId.startsWith('task_complete_')) {
    actionType = 'complete';
  } else if (customId.startsWith('task_unclaim_')) {
    actionType = 'unclaim';
  } else if (customId.startsWith('task_approve_')) {
    actionType = 'approve';
  }

  console.log(`[DEBUG] Determined actionType: ${actionType} for customId: ${customId}`);

  if (!actionType) {
    console.log(`[DEBUG] Unknown action type for customId: ${customId}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ Unknown button interaction.',
        flags: 64,
      },
    };
  }

  try {
    console.log(`[DEBUG] Processing ${actionType} action for task ${taskId}`);

    // For approve actions, check if it's on an ephemeral message
    if (actionType === 'approve') {
      const isEphemeral = interaction.message?.flags === 64;
      if (isEphemeral) {
        console.log('[DEBUG] Approve button pressed on ephemeral message.');
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: '❌ Approval actions must be performed on public messages.',
            flags: 64,
          },
        };
      }
    }

    // Perform the action
    const result = await performTaskAction(interaction, taskId, guildId, actionType);
    if (!result.success) {
      console.log(`[DEBUG] Action failed for task ${taskId}: ${result.error}`);
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: result.error,
          flags: 64,
        },
      };
    }

    console.log(`[DEBUG] ${actionType} action completed for task ${taskId}, refreshing task list messages`);
    void import('./taskListButton').then(({ refreshTaskListMessages }) => {
      refreshTaskListMessages(guildId).catch(console.error);
    });

    // Check if this is an individual task embed or task list embed
    const embedTitle = interaction.message?.embeds?.[0]?.title;
    const isIndividualTaskEmbed = embedTitle &&
      (embedTitle.includes('TASK OVERVIEW') ||
       embedTitle.includes('TASK CREATED') ||
       embedTitle.includes('TASK CLAIMED') ||
       embedTitle.includes('TASK COMPLETED') ||
       embedTitle.includes('TASK APPROVED') ||
       embedTitle.includes('TASK UNCLAIMED') ||
       embedTitle.includes('TASK DELETED') ||
       embedTitle.includes('ADMIN TASK UNCLAIM'));

    let updateMessageResponse;
    if (isIndividualTaskEmbed) {
      console.log(`[DEBUG] Detected individual task embed, generating updated task overview for task ${taskId}`);
      const { embed, components } = await generateTaskOverviewEmbed(taskId, guildId, userId, interaction);
      updateMessageResponse = {
        type: InteractionResponseType.UpdateMessage,
        data: {
          embeds: [embed],
          components,
        }
      };
    } else {
      console.log(`[DEBUG] Detected task list embed, generating updated task list response for user ${userId}`);
      // Generate updated task list response for live embed update
      let filter: 'completed' | undefined;
      let claimedBy: string | undefined;

      if (actionType === 'claim' || actionType === 'complete' || actionType === 'unclaim') {
        claimedBy = userId; // Show user's tasks
      } else if (actionType === 'approve') {
        filter = undefined; // Show all tasks for admin
      }

      console.log(`[DEBUG] Generating task list response for user ${userId}, filter: ${filter}, claimedBy: ${claimedBy}`);
      const { embeds, components } = await generateTaskListResponse(guildId, filter, undefined, claimedBy);
      console.log(`[DEBUG] Generated response with ${embeds?.length || 0} embeds and ${components?.length || 0} components`);

      if (components && components.length > 0) {
        console.log(`[DEBUG] First component row has ${components[0].components?.length || 0} buttons`);
        if (components[0].components && components[0].components.length > 0) {
          console.log(`[DEBUG] Button custom_ids: ${components[0].components.map((c: any) => c.custom_id).join(', ')}`);
        }
      }

      updateMessageResponse = {
        type: InteractionResponseType.UpdateMessage,
        data: {
          embeds,
          components,
        }
      };
    }

    console.log(`[DEBUG] Returning UpdateMessage response:`, JSON.stringify(updateMessageResponse, null, 2));
    return updateMessageResponse;
  } catch (err) {
    console.error(`[ERROR] Error handling task button interaction: ${err}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '❌ An error occurred while processing your request.',
        flags: 64,
      },
    };
  }
};
