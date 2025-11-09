import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const handleTaskSetDueDate = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (option) => option.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption | undefined;

    const dueDateOption = interaction.data.options?.find(
      (option) => option.name === 'due_date'
    ) as APIApplicationCommandInteractionDataStringOption | undefined;

    if (!taskOption?.value || !dueDateOption?.value) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed('❌ Missing Parameters', 'Both task and due date are required.')],
        flags: 64
      });
      return;
    }

    const taskInput = taskOption.value;
    const dueDateInput = dueDateOption.value;
    const guildId = interaction.guild_id!;
  
    const taskId = taskInput.includes('|') ? taskInput.split(' | ')[0] : taskInput;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dueDateInput)) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed(
          '❌ Invalid Date Format',
          'Please use the format YYYY-MM-DD (e.g., 2025-11-15)'
        )],
        flags: 64
      });
      return;
    }

    const dueDate = new Date(dueDateInput + 'T00:00:00.000Z');
    if (isNaN(dueDate.getTime())) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createErrorEmbed(
          '❌ Invalid Date',
          'Please enter a valid date in YYYY-MM-DD format'
        )],
        flags: 64
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [createWarningEmbed(
          '⚠️ Past Date Warning',
          'The date you entered is in the past. The due date has still been set.'
        )],
        flags: 64
      });
    }

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

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: 'BotTable',
        Key: {
          pk: guildId,
          sk: `task#${taskId}`,
        },
        UpdateExpression: 'SET dueDate = :dueDate',
        ExpressionAttributeValues: {
          ':dueDate': dueDate.toISOString(),
        },
      })
    );

    const successEmbed = createSuccessEmbed(
      '📅 Due Date Set Successfully',
      `Due date has been ${task.dueDate ? 'updated' : 'set'} for the task.`,
      [
        {
          name: '📋 Task',
          value: `**${task.title}**`,
          inline: false
        },
        {
          name: '📅 Due Date',
          value: `<t:${Math.floor(dueDate.getTime() / 1000)}:D> (<t:${Math.floor(dueDate.getTime() / 1000)}:R>)`,
          inline: true
        },
        {
          name: '📊 Status',
          value: getStatusEmoji(task.status) + ' ' + getStatusText(task.status),
          inline: true
        }
      ],
      interaction.member?.user?.username || 'Unknown User'
    );

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('Error setting task due date:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'An error occurred while setting the due date. Please try again.',
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

function createWarningEmbed(title: string, description: string): APIEmbed {
  return {
    color: 0xffaa00,
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
      text: `Set by ${footerText}`
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