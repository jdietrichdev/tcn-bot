import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { performTaskAction } from '../component-handlers/taskButtons';

export const handleTaskClaim = async (
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

    const responseData = await performTaskAction(interaction, taskId, guildId, 'claim');

    // If performTaskAction returned a simple content message (for errors/confirmations)
    if (responseData.content) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: responseData.content,
      });
    } else {
      // Otherwise, it returned a full embed and components
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: responseData.embeds,
        components: responseData.components,
      });
    }

    console.log(`Slash command /task-claim processed for task ${taskId}`);

  } catch (err) {
    console.error('Failed to handle /task-claim command:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: '❌ Failed to claim task. Please try again or contact an admin.',
    });
  }
};