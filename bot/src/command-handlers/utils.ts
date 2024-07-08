import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

export const getCommandOptionData = <T>(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string
): T => {
  return interaction.data.options?.find((option) => option.name === name) as T;
};

export const getGuildId = (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  return interaction.guild_id!;
};

export const getMessageSender = (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  return interaction.member!.user;
};
