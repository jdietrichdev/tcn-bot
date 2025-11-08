import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { handleDailyTaskReminders } from '../scheduled-handlers/dailyTaskReminders';

export const handleTaskReminders = async (
  interaction: APIChatInputApplicationCommandInteraction
): Promise<void> => {
  try {
    const guildId = interaction.guild_id!;
    
    await handleDailyTaskReminders({ guildId });

    const embed: APIEmbed = {
      title: '✅ ✦ TASK SUMMARIES SENT ✦',
      description: 'Task summaries have been processed and sent to assignees, showing all pending and claimed tasks grouped by role/user.',
      color: 0x00ff00,
      footer: {
        text: 'Task Management System • Manual summary trigger',
      },
      timestamp: new Date().toISOString(),
    };

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
    });
  } catch (err) {
    console.error('Failed to send task reminders:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to send task summaries. Please try again later.',
    });
  }
};