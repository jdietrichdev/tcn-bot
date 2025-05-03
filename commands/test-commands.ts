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
    })
    .addSubcommand((subcommand) => {
      return subcommand.setName("emoji").setDescription("Return an emoji");
    }),
  new SlashCommandBuilder()
    .setName("upgrade")
    .setDescription("Show upgrade info for selected troop")
    .addStringOption((option) => {
      return option
        .setName("troop")
        .setDescription("Troop to get upgrade information for")
        .setRequired(true)
        .setAutocomplete(true);
    }),

  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Apply to join This Clan Now"),

  new SlashCommandBuilder()
    .setName("recruit")
    .setDescription("Create recruitment opportunity")
    .addStringOption((option) => {
      return option
        .setName("user")
        .setDescription("User ID to reach out to")
        .setRequired(true);
    })
    .addStringOption((option) => {
      return option
        .setName("tag")
        .setDescription("Player tag for primary account")
        .setRequired(true);
    }),
];
