import { ChatInputCommandInteraction } from "discord.js";

export const handleTest = async (interaction: ChatInputCommandInteraction) => {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "demo") {
    await interaction.reply({ content: "Hello!", ephemeral: true });
  } else if (subcommand === "string-input") {
    await interaction.reply({
      content: `Here: ${interaction.options.getString("input")}`,
      ephemeral: true,
    });
  }
};
