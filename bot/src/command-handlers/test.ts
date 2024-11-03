import {
    APIChatInputApplicationCommandInteraction,
  } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const handleTest = async (
    interaction: APIChatInputApplicationCommandInteraction
) => {
    try {
        switch (interaction.data.options![0].name) {
            case "emoji":
                return await emoji(interaction);
        }
    } catch (err) {
        console.log(err);
        throw err;
    }
}

const emoji = async (interaction: APIChatInputApplicationCommandInteraction) => {
    await updateMessage(interaction.application_id, interaction.token, {
        content: '<:yeti:1301957376034865154>'
    });
}