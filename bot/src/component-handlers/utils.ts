import { getServerUser } from '../adapters/discord-adapter';
import { ServerConfig } from '../util/serverConfig';
import { BUTTONS } from './buttons';

const BUTTON_MODAL_TRIGGERS = [
  'apply',
  'leadApply',
  'denyApp',
  'signupAccount',
  'cwlQuestions',
  'vouch',
  'oppose',
  'indifferent',
  'linkAccount',
  'base_post_settings',
];
const COMMAND_MODAL_TRIGGERS = ['apply', 'lead-apply'];

export const isActorAdmin = async (
  guildId: string,
  userId: string,
  config: ServerConfig,
) => {
  const actor = await getServerUser(guildId, userId);
  return actor.roles.includes(config.ADMIN_ROLE);
};

export const isActorRecruiter = async (
  guildId: string,
  userId: string,
  config: ServerConfig,
) => {
  const actor = await getServerUser(guildId, userId);
  return actor.roles.includes(config.RECRUITER_ROLE);
};

export const determineRolesButton = async (
  guildId: string,
  userId: string,
  config: ServerConfig,
) => {
  const applicant = await getServerUser(guildId, userId);
  return applicant.roles.includes(config.CLAN_ROLE)
    ? BUTTONS.REMOVE_ROLES
    : BUTTONS.GRANT_ROLES;
};

export const buttonTriggersModal = (customId: string) => {
  return (
    BUTTON_MODAL_TRIGGERS.includes(customId) ||
    customId.startsWith('cwl_dashboard_edit:') ||
    customId.startsWith('cwl_dashboard_rename:') ||
    customId.startsWith('cwl_dashboard_add_tag:') ||
    customId.startsWith('cwl_dashboard_add_player:') ||
    customId.startsWith('cwl_dashboard_move_player:') ||
    customId.startsWith('cwl_dashboard_remove_player:')
  );
};

export const commandTriggersModal = (name: string) => {
  return COMMAND_MODAL_TRIGGERS.includes(name);
};
