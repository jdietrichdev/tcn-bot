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

export const timeConvert = (seconds: number) => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  console.log(d, h, m, s);
  const dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
  const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
  const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
  const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
  return dDisplay + hDisplay + mDisplay + sDisplay;
};
