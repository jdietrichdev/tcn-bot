import {
  APIMessageComponentInteraction,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
} from 'discord-api-types/v10';
import { getConfig } from '../util/serverConfig';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createChannel,
  sendMessage,
  updateMessage,
  updateResponse,
} from '../adapters/discord-adapter';
import { schedulerClient } from '../clients/scheduler-client';
import { DeleteScheduleCommand } from '@aws-sdk/client-scheduler';

export const claimEvent = async (
  interaction: APIMessageComponentInteraction,
) => {
  try {
    const [, guildId, eventId, prize, sponsor] =
      interaction.data.custom_id.split('_');
    const config = getConfig(guildId);
    const eventData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: guildId,
            sk: `event#${eventId}`,
          },
        }),
      )
    ).Item!;

    const channel = await createChannel(
      {
        name: `claim-${interaction.user!.username}`,
        topic: `Claim prize from ${eventData.name}`,
        type: ChannelType.GuildText,
        parent_id: config.EVENTS_CATEGORY,
        permission_overwrites: [
          {
            id: guildId,
            type: OverwriteType.Role,
            allow: '0',
            deny: PermissionFlagsBits.ViewChannel.toString(),
          },
          {
            id: config.BOT_ID,
            type: OverwriteType.Member,
            allow: (
              PermissionFlagsBits.ViewChannel |
              PermissionFlagsBits.AddReactions |
              PermissionFlagsBits.SendMessages
            ).toString(),
            deny: '0',
          },
          {
            id: interaction.user!.id,
            type: OverwriteType.Member,
            allow: (
              PermissionFlagsBits.ViewChannel |
              PermissionFlagsBits.AddReactions |
              PermissionFlagsBits.SendMessages
            ).toString(),
            deny: '0',
          },
          {
            id: sponsor,
            type: OverwriteType.Member,
            allow: (
              PermissionFlagsBits.ViewChannel |
              PermissionFlagsBits.AddReactions |
              PermissionFlagsBits.SendMessages
            ).toString(),
            deny: '0',
          },
        ],
      },
      guildId,
    );

    let message = `Congrats again on winning a ${prize} in our ${
      eventData.name
    } event <@${interaction.user!.id}>!`;
    message += ` Please coordinate with <@${sponsor}> to claim your prize.`;
    message += `\n\nPlease share your Supercell friend link or any other information that would be helpful for sending you your prize.`;
    await sendMessage(
      {
        content: message,
      },
      channel.id,
    );

    await updateMessage(interaction.channel.id, interaction.message.id, {
      components: [],
    });

    const rewards = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: interaction.guild_id,
            sk: 'event-rewards',
          },
        }),
      )
    ).Item!;

    const reward = rewards.find(
      (reward: Record<string, any>) => reward.eventId === eventId,
    );
    reward.status = 'Pending';

    await updateMessage(config.REWARD_TRACKING_CHANNEL, reward.message, {
      content: `Winner: ${interaction.user?.id}\nSponsor: ${sponsor}\nPrize: ${prize}\nStatus: Pending`,
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: rewards,
      }),
    );

    await schedulerClient.send(
      new DeleteScheduleCommand({
        Name: `reward-expiration-${interaction.channel.id}-${interaction.message.id}`,
      }),
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: 'Your claim process has begun!',
    });
  } catch (err) {
    console.error(`Failed to claim prize: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        'There was a failure claiming your prize, please try again or contact admin',
    });
  }
};
