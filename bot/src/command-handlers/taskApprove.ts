import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { performTaskAction } from '../component-handlers/taskButtons';

export const handleTaskApprove = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const taskOption = interaction.data.options?.find(
      (opt) => opt.name === 'task'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!taskOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Task selection is required.',
      });
      return;
    }

    const taskId = taskOption.value;
    const guildId = interaction.guild_id!;

    const responseData = await performTaskAction(interaction, taskId, guildId, 'approve');

    if (responseData.content) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: responseData.content,
      });
    } else {
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: responseData.embeds,
        components: responseData.components,
      });
    }

    console.log(`Slash command /task-approve processed for task ${taskId}`);

  } catch (err) {
    console.error('Failed to handle /task-approve command:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to approve task. Please try again or contact an admin.',
    });
  }
};