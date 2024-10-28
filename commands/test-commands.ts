import { SlashCommandBuilder } from "discord.js";

export const testCommands = [
  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Test commands")
    .addSubcommand((subcommand) => {
      return subcommand.setName("demo").setDescription("Demo test command");
    })
    .addSubcommand((subcommand) => {
      return subcommand
        .setName("string-input")
        .setDescription("Test string input with subcommand")
        .addStringOption((option) => {
          return option
            .setName("input")
            .setDescription("What should I say?")
            .setRequired(true);
        });
    }),
];
