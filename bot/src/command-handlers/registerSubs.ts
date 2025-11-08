import { 
  APIChatInputApplicationCommandInteraction, 
  APIApplicationCommandInteractionDataStringOption,
  APIEmbed,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../util/serverConfig';

export const handleRegisterSubsCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const guildId = interaction.guild_id;
    if (!guildId) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    const config = getConfig(guildId);

    const clanOutOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-out'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clanOutPlayersOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-out-players'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clanInOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-in'
    ) as APIApplicationCommandInteractionDataStringOption;
    
    const clanInPlayersOption = interaction.data.options?.find(
      (opt) => opt.name === 'clan-in-players'
    ) as APIApplicationCommandInteractionDataStringOption;

    if (!clanOutOption || !clanOutPlayersOption || !clanInOption || !clanInPlayersOption) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Missing required parameters.',
      });
      return;
    }

    const clanOutKey = clanOutOption.value;
    const clanOutPlayers = clanOutPlayersOption.value;
    const clanInKey = clanInOption.value;
    const clanInPlayers = clanInPlayersOption.value;

    // Look up clan configs
    const clanOutConfig = config.CLANS[clanOutKey];
    const clanInConfig = config.CLANS[clanInKey];

    if (!clanOutConfig) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Clan "${clanOutKey}" not found in server config. Available clans: ${Object.keys(config.CLANS).join(', ')}`,
      });
      return;
    }

    if (!clanInConfig) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Clan "${clanInKey}" not found in server config. Available clans: ${Object.keys(config.CLANS).join(', ')}`,
      });
      return;
    }

    // Extract user IDs from mentions
    const clanOutIds = extractUserIds(clanOutPlayers);
    const clanInIds = extractUserIds(clanInPlayers);

    if (clanOutIds.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ No valid user mentions found for players leaving. Use @username format.',
      });
      return;
    }

    if (clanInIds.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ No valid user mentions found for players joining. Use @username format.',
      });
      return;
    }

    const subId = uuidv4();
    const requestedBy = interaction.member?.user?.id || 'Unknown';

    // Store in DynamoDB with clan config data
    await dynamoDbClient.send(
      new PutCommand({
        TableName: 'BotTable',
        Item: {
          pk: `subs#${guildId}`,
          sk: `request#${subId}`,
          clanOutKey,
          clanOutIds,
          clanOutName: clanOutConfig.name,
          clanOutApprovalChannelId: clanOutConfig.leadChannel,
          clanOutNotificationChannelId: clanOutConfig.clanChannel,
          clanInKey,
          clanInIds,
          clanInName: clanInConfig.name,
          clanInApprovalChannelId: clanInConfig.leadChannel,
          clanInNotificationChannelId: clanInConfig.clanChannel,
          requestedBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })
    );

    // Create approval embeds for each clan
    const clanOutApprovalEmbed: APIEmbed = {
      title: '🔄 Substitution Request',
      description: `**Requested by:** <@${requestedBy}>`,
      fields: [
        {
          name: `📤 Players Leaving ${clanOutConfig.name}`,
          value: clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: `📥 Players Joining from ${clanInConfig.name}`,
          value: clanInIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: '📢 Notification Channel',
          value: `<#${clanOutConfig.clanChannel}>`,
          inline: false,
        },
      ],
      color: 0x5865F2,
      footer: {
        text: `Sub ID: ${subId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const clanInApprovalEmbed: APIEmbed = {
      title: '🔄 Substitution Request',
      description: `**Requested by:** <@${requestedBy}>`,
      fields: [
        {
          name: `📤 Players Leaving to ${clanOutConfig.name}`,
          value: clanOutIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: `📥 Players Joining ${clanInConfig.name}`,
          value: clanInIds.map((id: string) => `<@${id}>`).join('\n'),
          inline: true,
        },
        {
          name: '📢 Notification Channel',
          value: `<#${clanInConfig.clanChannel}>`,
          inline: false,
        },
      ],
      color: 0x5865F2,
      footer: {
        text: `Sub ID: ${subId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const approvalMessage = (embed: APIEmbed) => ({
      embeds: [embed],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              custom_id: `approve_sub_${subId}`,
              label: 'Approve',
              style: ButtonStyle.Success,
              emoji: { name: '✅' },
            },
            {
              type: ComponentType.Button,
              custom_id: `deny_sub_${subId}`,
              label: 'Deny',
              style: ButtonStyle.Danger,
              emoji: { name: '❌' },
            },
          ],
        },
      ],
    });

    const discordBotToken = process.env.BOT_TOKEN;

    if (!discordBotToken) {
      console.error('BOT_TOKEN environment variable is not set');
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Bot token is not configured.',
      });
      return;
    }

    let successCount = 0;
    
    // Send to clan OUT approval channel (lead channel)
    try {
      console.log(`Sending approval message to ${clanOutConfig.name} lead channel: ${clanOutConfig.leadChannel}`);
      const clanOutResponse = await fetch(
        `https://discord.com/api/v10/channels/${clanOutConfig.leadChannel}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
          body: JSON.stringify(approvalMessage(clanOutApprovalEmbed)),
        }
      );

      if (clanOutResponse.ok) {
        successCount++;
        console.log(`Successfully sent approval message to ${clanOutConfig.name}`);
      } else {
        const errorText = await clanOutResponse.text();
        console.error(`Failed to send approval message to ${clanOutConfig.name}:`, errorText);
      }
    } catch (error) {
      console.error(`Error sending to ${clanOutConfig.name} approval channel:`, error);
    }

    // Send to clan IN approval channel (lead channel)
    try {
      console.log(`Sending approval message to ${clanInConfig.name} lead channel: ${clanInConfig.leadChannel}`);
      const clanInResponse = await fetch(
        `https://discord.com/api/v10/channels/${clanInConfig.leadChannel}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${discordBotToken}`,
          },
          body: JSON.stringify(approvalMessage(clanInApprovalEmbed)),
        }
      );

      if (clanInResponse.ok) {
        successCount++;
        console.log(`Successfully sent approval message to ${clanInConfig.name}`);
      } else {
        const errorText = await clanInResponse.text();
        console.error(`Failed to send approval message to ${clanInConfig.name}:`, errorText);
      }
    } catch (error) {
      console.error(`Error sending to ${clanInConfig.name} approval channel:`, error);
    }

    if (successCount === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: '❌ Failed to send approval messages to any channels. Please check the clan configuration and bot permissions.',
      });
      return;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Substitution request submitted! Approval messages sent to ${clanOutConfig.name} and ${clanInConfig.name} leadership channels.`,
    });

  } catch (error) {
    console.error('Error in handleRegisterSubsCommand:', error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `❌ An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
};

function extractUserIds(text: string): string[] {
  const mentions = text.match(/<@!?(\d+)>/g);
  if (!mentions) return [];
  return mentions.map((mention) => {
    const match = mention.match(/\d+/);
    return match ? match[0] : '';
  }).filter(Boolean);
}
