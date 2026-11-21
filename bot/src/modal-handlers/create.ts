import {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
  InteractionType,
} from 'discord-api-types/v10';
import { createApplyModal } from './apply';
import { createDenyAppModal } from './denyApp';
import { createLeadApplyModal } from './leadApply';
import { createCwlAccountSignupModal } from './signupAccount';
import { createCwlQuestionsModal } from './cwlQuestions';
import { createVoteNominationModal } from './nominationVote';
import { createLinkAccountModal } from './linkAccount';
import { createBasePostSettingsModal } from './basePost';
import { createCwlDashboardModal } from './cwlDashboard';

export const createModal = async (
  interaction:
    | APIMessageComponentInteraction
    | APIApplicationCommandInteraction,
  trigger: string,
) => {
  if (
    interaction.type === InteractionType.MessageComponent &&
    (trigger.startsWith('cwl_dashboard_edit:') ||
      trigger.startsWith('cwl_dashboard_rename:') ||
      trigger.startsWith('cwl_dashboard_add_tag:') ||
      trigger.startsWith('cwl_dashboard_add_player:') ||
      trigger.startsWith('cwl_dashboard_move_player:') ||
      trigger.startsWith('cwl_dashboard_remove_player:'))
  ) {
    return createCwlDashboardModal(interaction);
  }

  switch (trigger) {
    case 'apply':
      return createApplyModal(interaction);
    case 'lead-apply':
    case 'applyLead':
      return createLeadApplyModal(interaction);
    case 'denyApp':
      return createDenyAppModal(interaction as APIMessageComponentInteraction);
    case 'signupAccount':
      return createCwlAccountSignupModal(
        interaction as APIMessageComponentInteraction,
      );
    case 'cwlQuestions':
      return createCwlQuestionsModal(
        interaction as APIMessageComponentInteraction,
      );
    case 'vouch':
    case 'oppose':
    case 'indifferent':
      return createVoteNominationModal(
        interaction as APIMessageComponentInteraction,
      );
    case 'linkAccount':
      return createLinkAccountModal(
        interaction as APIMessageComponentInteraction,
      );
    case 'base_post_settings':
      if (interaction.type !== InteractionType.MessageComponent) {
        throw new Error('Base-post settings must be opened from a message.');
      }
      return createBasePostSettingsModal(interaction);
    default:
      throw new Error('No handler defined for creating modal');
  }
};
