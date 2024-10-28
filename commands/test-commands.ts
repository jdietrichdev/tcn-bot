import { SlashCommandBuilder } from "discord.js";

export const testCommands = [
  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Test commands")
    .addSubcommand((subcommand) => {
      return subcommand.setName("demo").setDescription("Demo test command");
    }),
];
