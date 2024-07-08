import {
  APIApplicationCommandInteractionDataSubcommandOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";

export const getCommandOptionData = <T>(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string
): T => {
  return interaction.data.options?.find((option) => option.name === name) as T;
};

export const getSubCommandOptionData = <T>(
  interaction: APIChatInputApplicationCommandInteraction,
  subCommand: string,
  name: string
) => {
  return (
    interaction.data.options?.find(
      (option) => option.name === subCommand
    ) as APIApplicationCommandInteractionDataSubcommandOption
  ).options?.find((option) => option.name === name) as T;
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
