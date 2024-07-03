import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10"

export const getCommandOptionData = (interaction: APIChatInputApplicationCommandInteraction, name: string) => {
    return interaction.data.options?.find(option => option.name === name);
}