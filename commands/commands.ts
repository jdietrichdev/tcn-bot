import { SlashCommandBuilder } from "discord.js";

const helloCommand = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say hello to someone")
  .addUserOption((option) => {
    return option
      .setName("user")
      .setDescription("Who do you want to say hello to?")
      .setRequired(true);
  });

const playerCommands = new SlashCommandBuilder()
  .setName("player")
  .setDescription("Interact with players")
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("add")
      .setDescription("Add player to team roster")
      .addStringOption((option) => {
        return option
          .setName("roster")
          .setDescription("Which roster should the player be added to")
          .setRequired(true)
          .setChoices([
            {
              name: "TCN Tyrants",
              value: "tyrants",
            },
          ]);
      })
      .addUserOption((option) => {
        return option
          .setName("user")
          .setDescription("Which player needs to be added")
          .setRequired(false);
      });
  });

export const commands = [helloCommand, playerCommands];
