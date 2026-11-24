import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/payloads/v10';
import { verify } from '../adapters/coc-api-adapter';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import {
  getMessageSender,
  getSubCommandOptionData,
} from '../util/interaction-util';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { findPlayerLinks, normalizePlayerTag } from '../util/playerLink';
import { getConfig } from '../util/serverConfig';
import { importPointPlayerLinks } from '../util/importPointPlayerLinks';

export const handleLink = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  try {
    switch (interaction.data.options![0].name) {
      case 'create':
        return await linkPlayer(interaction);
      case 'remove':
        return await unlinkPlayer(interaction);
      case 'verify':
        return await verifyPlayer(interaction);
      case 'add':
        return await addPlayer(interaction);
      case 'import':
        return await importPlayerLinks(interaction);
      default:
        throw new Error('No processing defined for that command');
    }
  } catch (err) {
    console.log('Failure handling link command', err);
    throw err;
  }
};

const linkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  const inputTag =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      'create',
      'tag',
    ).value;
  const apiToken =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      'create',
      'token',
    ).value;
  const user = getMessageSender(interaction).id;
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
        if (item.pk === user) {
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
          pk: user,
          sk: `player#${playerTag.substring(1)}`,
          id: user,
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

const verifyPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  const inputTag = getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
    interaction, 'verify', 'tag',
  ).value;
  const token = getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
    interaction, 'verify', 'token',
  ).value;
  let tag: string;
  try {
    tag = normalizePlayerTag(inputTag);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Please provide a valid player tag.',
    });
    return;
  }
  const key = { pk: getMessageSender(interaction).id, sk: `player#${tag.substring(1)}` };
  try {
    const result = await dynamoDbClient.send(new GetCommand({
      TableName: 'BotTable',
      Key: key,
      ConsistentRead: true,
    }));
    if (!result.Item) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'This player tag is not linked to your Discord account.',
      });
      return;
    }
    if (result.Item.verified !== false) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'This account is already verified.',
      });
      return;
    }
    try {
      await verify(tag, token);
    } catch {
      await updateResponse(interaction.application_id, interaction.token, {
        content: 'There was an issue verifying your credentials, please try again.',
      });
      return;
    }
    await dynamoDbClient.send(new UpdateCommand({
      TableName: 'BotTable',
      Key: key,
      UpdateExpression: 'SET verified = :verified',
      ConditionExpression: 'attribute_exists(pk) AND verified = :unverified',
      ExpressionAttributeValues: { ':verified': true, ':unverified': false },
    }));
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Your linked account has been verified successfully!',
    });
  } catch (err) {
    console.error('Error verifying linked account:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'There was an issue verifying your linked account, please try again.',
    });
  }
};

const addPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  if (!hasLinkStaffRole(interaction)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Only admins and co-leaders can add links for other users.',
    });
    return;
  }
  const inputTag = getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
    interaction, 'add', 'tag',
  ).value;
  const user = getSubCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
    interaction, 'add', 'user',
  ).value;
  let tag: string;
  try {
    tag = normalizePlayerTag(inputTag);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Please provide a valid player tag.',
    });
    return;
  }
  try {
    const existingLinks = await findPlayerLinks(tag);
    if (existingLinks.length) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: existingLinks.some((item) => item.pk === user)
          ? 'This player tag is already linked to that Discord user.'
          : 'This player tag is already linked to another Discord account.',
      });
      return;
    }
    await dynamoDbClient.send(new PutCommand({
      TableName: 'BotTable',
      Item: { pk: user, sk: `player#${tag.substring(1)}`, id: user, tag, verified: false },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Linked ${tag} to <@${user}> without verification. They can use /link verify.`,
      allowed_mentions: { parse: [] },
    });
  } catch (err) {
    console.error('Error adding account link:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'There was an issue adding the account link, please try again.',
    });
  }
};

const hasLinkStaffRole = (interaction: APIChatInputApplicationCommandInteraction) => {
  if (!interaction.guild_id) return false;
  const config = getConfig(interaction.guild_id);
  return (interaction.member?.roles ?? []).some((role) =>
    role === config.ADMIN_ROLE || (config.CO_LEAD_ROLE && role === config.CO_LEAD_ROLE),
  );
};

const importPlayerLinks = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  if (interaction.guild_id !== '1310007885656363068' || !hasLinkStaffRole(interaction)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Only Point admins and co-leaders can import these links.',
    });
    return;
  }
  try {
    const result = await importPointPlayerLinks();
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Import finished: ${result.created} linked without verification, ${result.existing} already linked, ${result.conflicts} conflicts, ${result.invalid} invalid or blank rows, ${result.failed} failed. Existing links were not changed.`,
    });
  } catch (err) {
    console.error('Error importing player links:', err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'The import could not be completed. Some links may already have been created; please retry.',
    });
  }
};

const unlinkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction,
) => {
  try {
    const playerTag =
      getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        'remove',
        'tag',
      ).value;
    const user = getMessageSender(interaction).id;
    const response = await dynamoDbClient.send(
      new DeleteItemCommand({
        TableName: 'BotTable',
        Key: {
          pk: { S: user },
          sk: { S: `player#${playerTag.substring(1)}` },
        },
      }),
    );
    console.log(response);
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'User successfully unlinked',
    });
  } catch (err) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Failure removing account link, please try again',
    });
    console.log('Failure unlinking account', err);
  }
};
