import { getServerUser } from "../adapters/discord-adapter"
import { ServerConfig } from "../util/serverConfig";
import { BUTTONS } from "./buttons";

const MODAL_TRIGGERS = ["apply", "leadApply", "denyApp"];

export const isActorAdmin = async (guildId: string, userId: string, config: ServerConfig) => {
    const actor = await getServerUser(guildId, userId);
    return actor.roles.includes(config.ADMIN_ROLE);
}

export const isActorRecruiter = async (guildId: string, userId: string, config: ServerConfig) => {
    const actor = await getServerUser(guildId, userId);
    return actor.roles.includes(config.RECRUITER_ROLE);
}

export const determineRolesButton = async (guildId: string, userId: string, config: ServerConfig) => {
    const applicant = await getServerUser(guildId, userId);
    return applicant.roles.includes(config.CLAN_ROLE) ? BUTTONS.REMOVE_ROLES : BUTTONS.GRANT_ROLES;
}

export const buttonTriggersModal = (customId: string) => {
    return MODAL_TRIGGERS.includes(customId);
}