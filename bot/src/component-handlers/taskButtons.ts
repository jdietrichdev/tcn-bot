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

export const handleTaskButtonInteraction = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const guildId = interaction.guild_id!;
  const userId = interaction.member?.user?.id || interaction.user?.id!;

  console.log(`[DEBUG] Handling button interaction: customId=${customId}, guildId=${guildId}, userId=${userId}`);

  // Handle action buttons - perform action then return ephemeral task list
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

  if (!actionType) {
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

    // Return ephemeral task list response
    let filter: 'completed' | undefined;
    let claimedBy: string | undefined;

    if (actionType === 'claim' || actionType === 'complete' || actionType === 'unclaim') {
      claimedBy = userId; // Show user's tasks
    } else if (actionType === 'approve') {
      filter = undefined; // Show all tasks for admin
    }

    const { embeds, components } = await generateTaskListResponse(guildId, filter, undefined, claimedBy);
    return {
      type: InteractionResponseType.UpdateMessage,
      data: {
        embeds,
        components
      }
    };
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
