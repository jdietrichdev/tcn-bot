import { APIMessageComponentInteraction, APITextChannel } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { getServerUser, grantRole, sendMessage } from "../adapters/discord-adapter";

export const grantRoles = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        const approver = await getServerUser(interaction.guild_id!, interaction.member!.user.id);
        if (approver.roles.includes(config.RECRUITER_ROLE)) {
            const userId = (interaction.channel as APITextChannel).topic!.split(":")[1];
            await grantRole(interaction.guild_id!, userId, config.CLAN_ROLE);
            await sendMessage(
                {
                    content: `Roles granted by ${interaction.member?.user.username}`,
                },
                interaction.channel.id
            );
        } else {
            await sendMessage(
                {
                    content: `You do not have permission to approve this ticket <@${interaction.member?.user.id}>`,
                },
                interaction.channel.id
            );
        }
    } catch (err) {
        console.error(`Failed to grant roles: ${err}`);
    }
}