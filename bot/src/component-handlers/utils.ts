import { getServerUser } from "../adapters/discord-adapter"
import { ServerConfig } from "../util/serverConfig";

export const isActorRecruiter = async (guildId: string, userId: string, config: ServerConfig) => {
    const actor = await getServerUser(guildId, userId);
    return actor.roles.includes(config.RECRUITER_ROLE);
}