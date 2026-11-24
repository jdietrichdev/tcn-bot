import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
  APIModalSubmitInteraction,
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { updateResponse } from '../adapters/discord-adapter';
import { verify } from '../adapters/coc-api-adapter';
import { getModalTextInputValue } from '../util/modalComponents';
import { findPlayerLinks, normalizePlayerTag } from '../util/playerLink';

export const createLinkAccountModal = (
  _interaction: APIMessageComponentInteraction,
): APIInteractionResponse => {
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: 'linkAccountModal',
      title: 'Link your account',
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: 'playerTag',
              label: 'Player tag',
              style: TextInputStyle.Short,
              required: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: 'apiToken',
              label: 'API Token',
              placeholder:
                'Profile > Settings > More Settings > API Token > Show > Copy',
              style: TextInputStyle.Short,
              required: true,
            },
          ],
        },
      ],
    },
  } as APIInteractionResponse;
};

export const submitLinkAccountModal = async (
  interaction: APIModalSubmitInteraction,
) => {
  const { playerTag: inputTag, apiToken } = getLinkAccountData(interaction);
  let playerTag: string;
  try {
    playerTag = normalizePlayerTag(inputTag);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Please provide a valid player tag.',
    });
    return;
  }
  try {
    const existingLinks = await findPlayerLinks(playerTag);
    if (existingLinks.length > 0) {
      for (const item of existingLinks) {
        if (item.pk === interaction.member!.user.id) {
          await updateResponse(interaction.application_id, interaction.token, {
            content: item.verified === false
              ? 'Your account is already linked but not verified. Use /link verify.'
              : 'Your account is already linked, no further action is needed',
          });
          return;
        }
      }
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'This player tag is already linked to another discord account',
      });
      return;
    }
  } catch (err) {
    console.error('Error checking for existing links:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        'There was an issue checking for existing links, please try again',
    });
    return;
  }

  try {
    await verify(playerTag, apiToken);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        'There was an issue verifying your credentials, please try again',
    });
    return;
  }

  try {
    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: interaction.member!.user.id,
          sk: `player#${playerTag.substring(1)}`,
          id: interaction.member!.user.id,
          tag: playerTag,
          verified: true,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Your account has been linked successfully!',
    });
  } catch (err) {
    console.error('Error linking account:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'There was an issue linking your account, please try again',
    });
    return;
  }
};

const getLinkAccountData = (interaction: APIModalSubmitInteraction) => {
  return {
    playerTag: getModalTextInputValue(interaction, 0),
    apiToken: getModalTextInputValue(interaction, 1),
  };
};
