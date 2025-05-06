import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const closeRecruit = async (interaction: APIMessageComponentInteraction) => {
    try {
        await updateMessage(interaction.application_id, interaction.token, {
            content: interaction.message.content.split('\n').splice(1).join("\n"),
            components: []
        });
    } catch (err) {
        console.error(`Failure closing recruit message: ${err}`);
    }
};