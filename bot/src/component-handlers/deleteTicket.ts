import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteChannel, sendMessage } from "../adapters/discord-adapter";
import { isActorRecruiter } from "./utils";
import { ServerConfig } from "../util/serverConfig";

export const deleteTicket = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        if (await isActorRecruiter(interaction.guild_id!, interaction.member!.user.id, config)) {
            const channelId = interaction.message.channel_id;
            await deleteChannel(channelId);
        } else {
            await sendMessage(
                {
                    content: `You do not have permissions to delete this ticket <@${interaction.member?.user.id}`,
                },
                interaction.channel.id
            )
        }
    } catch (err) {
        console.error(`Failed to delete ticket: ${err}`);
    }
}