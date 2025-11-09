import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIEmbed
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskAssign = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (option) => option.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption | undefined;

    const userOption = interaction.data.options?.find(
      (option) => option.name === 'user'
    ) as APIApplicationCommandInteractionDataUserOption | undefined;

    if (!taskOption?.value || !userOption?.value) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed('❌ Missing Parameters', 'Both task and user are required.')],
        flags: 64
      });
      return;
    }

    const taskInput = taskOption.value;
    const userId = userOption.value;
    const guildId = interaction.guild_id!;
    const assignerId = interaction.member?.user?.id || 'Unknown';
  
    const taskId = taskInput.includes('|') ? taskInput.split(' | ')[0] : taskInput;

    const getResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
      })
    );

    if (!getResult.Item) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed(
          '❌ Task Not Found',
          'The specified task could not be found.'
        )],
        flags: 64
      });
      return;
    }

    const task = getResult.Item;

    if (task.status === 'completed' || task.status === 'approved') {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed(
          '❌ Cannot Assign Completed Task',
          'This task is already completed or approved and cannot be reassigned.'
        )],
        flags: 64
      });
      return;
    }

    const now = new Date().toISOString();

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET assignedTo = :assignedTo, assignedBy = :assignedBy, assignedAt = :assignedAt',
        ExpressionAttributeValues: {
          ':assignedTo': userId,
          ':assignedBy': assignerId,
          ':assignedAt': now,
        },
      })
    );

    const successEmbed = createSuccessEmbed(
      '👤 Task Assigned Successfully',
      `Task has been assigned to <@${userId}>. They will need to claim it to begin work.`,
      [
        {
          name: '📋 Task',
          value: `**${task.title}**`,
          inline: false
        },
        {
          name: '👤 Assigned To',
          value: `<@${userId}>`,
          inline: true
        },
        {
          name: '📊 Status',
          value: getStatusEmoji(task.status) + ' ' + getStatusText(task.status),
          inline: true
        },
        {
          name: '📝 Priority',
          value: getPriorityEmoji(task.priority) + ' ' + (task.priority || 'Medium'),
          inline: true
        }
      ],
      interaction.member?.user?.username || 'Unknown User'
    );

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      successEmbed.fields?.push({
        name: '📅 Due Date',
        value: `<t:${Math.floor(dueDate.getTime() / 1000)}:D> (<t:${Math.floor(dueDate.getTime() / 1000)}:R>)`,
        inline: true
      });
    }

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('Error assigning task:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'An error occurred while assigning the task. Please try again.',
        timestamp: new Date().toISOString()
      }],
      flags: 64
    });
  }
};

function createErrorEmbed(title: string, description: string): APIEmbed {
  return {
    color: 0xff0000,
    title,
    description,
    timestamp: new Date().toISOString()
  };
}

function createSuccessEmbed(title: string, description: string, fields: any[], footerText: string): APIEmbed {
  return {
    color: 0x00ff00,
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: `Assigned by ${footerText}`
    }
  };
}

function getStatusEmoji(status: string): string {
  const statusEmojis = {
    pending: '📬',
    claimed: '📪',
    completed: '✅',
    approved: '☑️'
  };
  return statusEmojis[status as keyof typeof statusEmojis] || '❓';
}

function getStatusText(status: string): string {
  const statusTexts = {
    pending: 'Pending',
    claimed: 'Claimed',
    completed: 'Ready for Review',
    approved: 'Approved'
  };
  return statusTexts[status as keyof typeof statusTexts] || 'Unknown';
}

function getPriorityEmoji(priority: string): string {
  const priorityEmojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  return priorityEmojis[priority as keyof typeof priorityEmojis] || '🟡';
}