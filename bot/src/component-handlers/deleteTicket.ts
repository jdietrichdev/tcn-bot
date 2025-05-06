import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteChannel } from "../adapters/discord-adapter";

export const deleteTicket = async (interaction: APIMessageComponentInteraction) => {
    try {
        const channelId = interaction.message.channel_id;
        await deleteChannel(channelId);
    } catch (err) {
        console.error(`Failed to delete ticket: ${err}`);
    }
}