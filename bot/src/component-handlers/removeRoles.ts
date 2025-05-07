import { APIMessageComponentInteraction, APITextChannel } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { removeRole, sendMessage } from "../adapters/discord-adapter";
import { isActorRecruiter } from "./utils";

export const removeRoles = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        if (await isActorRecruiter(interaction.guild_id!, interaction.member!.user.id, config)) {
            const userId = (interaction.channel as APITextChannel).topic!.split(':')[1];
            await removeRole(interaction.guild_id!, userId, config.CLAN_ROLE);
            await sendMessage(
                {
                    content: `Roles removed by ${interaction.member?.user.username}`,
                },
                interaction.channel.id
            );
        } else {
            await sendMessage(
                {
                    content: `You do not have permissions to remove roles <@${interaction.member?.user.id}`,
                },
                interaction.channel.id
            )
        }
    } catch (err) {
        console.error(`Failed to remove roles: ${err}`);
    }
}