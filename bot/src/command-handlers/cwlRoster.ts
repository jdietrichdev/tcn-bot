import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  deleteMessage,
  sendMessage,
  updateResponse,
  updateMessage,
  createRole,
  createChannel,
  grantRole,
  deleteRole,
  deleteChannel,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getCommandOptionData } from "../util/interaction-util";
import { getClan, getCwl } from "../adapters/coc-api-adapter";
import { WAR_LEAGUE } from "../constants/emojis/coc/cwlLeague";
import { createDiscordTimestamp } from "../util/format-util";
import { DiscordError } from "../util/errors";

export const handleCwlRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const rosterName =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "roster"
      ).value;
    const notificationType =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "type"
      ).value;

    const response = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: {
          pk: interaction.guild_id!,
          sk: `roster#${rosterName}`,
        },
      })
    );
    const rosterData = response.Item!;
    console.log(JSON.stringify(rosterData));

    if (notificationType === "Announcement") {
      console.log("Sending roster announcement");
      const announcementMessages = await buildAnnouncement(rosterData.roster);
      if (rosterData.previousMessages) {
        for (const messageId of rosterData.previousMessages) {
          try {
            await deleteMessage(config.CWL_ROSTER_CHANNEL, messageId);
          } catch (err) {
            if ((err as DiscordError).statusCode === 404) {
              console.log("Message already deleted, continuing...");
            } else throw err;
          }
        }
      }
      const previousMessages: string[] = [];
      for (const message of announcementMessages) {
        const { id } = await sendMessage(
          { content: message.content?.split("\n")[0] },
          config.CWL_ROSTER_CHANNEL
        );
        await updateMessage(config.CWL_ROSTER_CHANNEL, id, message);
        previousMessages.push(id);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: {
            ...rosterData,
            previousMessages,
          },
        })
      );
      await updateResponse(interaction.application_id, interaction.token, {
        content: "CWL roster announcement sent",
      });
    } else if (notificationType === "Reminder") {
      console.log("Sending roster reminder");
      const reminderMessages = await buildReminder(rosterData.roster);
      for (const message of reminderMessages) {
        await sendMessage(message, config.GENERAL_CHANNEL);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await updateResponse(interaction.application_id, interaction.token, {
        content: "CWL roster reminders sent",
      });
    } else if (notificationType === "Setup") {
      console.log("Setting up roles and channels for CWL");
      for (const clan of rosterData.roster) {
        if (!clan.role) {
          const role = await createRole(
            interaction.guild_id!,
            `${clan.clan}_CWL`
          );
          clan.role = role.id;
        }
        for (const player of clan.players) {
          if (/^\d{17,19}$/.test(player.userId)) {
            await grantRole(interaction.guild_id!, player.userId, clan.role);
          }
        }
        if (!clan.channel) {
          const channel = await createChannel(
            {
              name: `cwl_${clan.clan}`,
              type: ChannelType.GuildText,
              topic: `CWL channel for ${clan.clan}`,
              parent_id: config.CWL_CATEGORY,
              permission_overwrites: [
                {
                  id: interaction.guild_id!,
                  type: OverwriteType.Role,
                  allow: "0",
                  deny: PermissionFlagsBits.ViewChannel.toString(),
                },
                {
                  id: clan.role,
                  type: OverwriteType.Role,
                  allow: (
                    PermissionFlagsBits.ViewChannel |
                    PermissionFlagsBits.AddReactions |
                    PermissionFlagsBits.SendMessages
                  ).toString(),
                  deny: "0",
                },
                {
                  id: config.BOT_ID,
                  type: OverwriteType.Member,
                  allow: (
                    PermissionFlagsBits.ViewChannel |
                    PermissionFlagsBits.AddReactions |
                    PermissionFlagsBits.SendMessages
                  ).toString(),
                  deny: "0",
                },
              ],
            },
            interaction.guild_id!
          );
          clan.channel = channel.id;
        }
      }
      await dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: {
            ...rosterData,
          },
        })
      );
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Channels and roles have been created for CWL",
      });
    } else if (notificationType === "Cleanup") {
      console.log("Cleaning up roles and channels for CWL");
      for (const clan of rosterData.roster) {
        if (clan.role) {
          await deleteRole(interaction.guild_id!, clan.role);
          delete clan.role;
        }
        if (clan.channel) {
          await deleteChannel(clan.channel);
          delete clan.channel;
        }
      }
      await dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: {
            ...rosterData,
          },
        })
      );
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Roles and channels have been cleaned up from CWL",
      });
    }
  } catch (err) {
    console.error(`Failed to send roster message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure processing roster command, please try again",
    });
  }
};

const buildAnnouncement = async (roster: Record<string, any>[]) => {
  const messages: RESTPostAPIWebhookWithTokenJSONBody[] = [];
  for (const clan of roster) {
    const clanData = await getClan(`#${clan.clanTag}`);
    let message = `# ${
      WAR_LEAGUE[clanData.warLeague.name as keyof typeof WAR_LEAGUE]
    } **${clanData.warLeague.name}**\n## [${
      clanData.name
    }](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${
      clan.clanTag
    }>)\n`;
    for (const player of clan.players) {
      message += `<@${player.userId}> | ${player.playerName} | \`${player.playerTag}\`\n`;
    }
    messages.push({ content: message.replace(/_/g, "\\_") });
  }
  messages.push({
    content: `*Last updated: <t:${createDiscordTimestamp(
      new Date().toUTCString()
    )}:R>*`,
  });
  return messages;
};

const buildReminder = async (roster: Record<string, any>[]) => {
  const messages: RESTPostAPIWebhookWithTokenJSONBody[] = [];
  messages.push({
    content:
      "[REMINDER]\nCWL spin is coming soon! Please make sure you are in the right clan and help those that are not!",
  });
  for (const clan of roster) {
    const cwlStatus = await getCwl(`#${clan.clanTag}`);
    console.log(JSON.stringify(cwlStatus));
    const clanData = await getClan(`#${clan.clanTag}`);

    let message = `# ${
      WAR_LEAGUE[clanData.warLeague.name as keyof typeof WAR_LEAGUE]
    } **${clanData.warLeague.name}**\n## [${
      clanData.name
    }](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${
      clan.clanTag
    }>)\n`;

    if (
      cwlStatus.state === "not_spun" ||
      cwlStatus.state === "notInWar" ||
      cwlStatus.state === "ended"
    ) {
      const missingPlayers = clan.players.filter(
        (player: Record<string, string>) => {
          return !clanData.memberList.some(
            (member: Record<string, any>) => member.tag === player.playerTag
          );
        }
      );

      if (missingPlayers.length === 0)
        message += "All players in clan, well done\n";
      else {
        for (const player of missingPlayers) {
          message += `<@${player.userId}> | ${player.playerName} | \`${player.playerTag}\`\n`;
        }
      }
      messages.push({ content: message.replace(/_/g, "\\_") });
    } else {
      const clanCwlData = cwlStatus.clans.find(
        (cwlClan: Record<string, any>) => cwlClan.tag === `#${clan.clanTag}`
      );
      const missedSpin = clan.players.filter((player: Record<string, any>) => {
        return !clanCwlData.members.some(
          (member: Record<string, any>) => member.tag === player.playerTag
        );
      });
      if (missedSpin.length === 0)
        message += "CWL spun with all members, good luck all!";
      else {
        message +=
          "CWL has been spun. If your name is below, better reach out to some important people!\n";
        for (const missed of missedSpin) {
          message += `<@${missed.userId}> | ${missed.playerName} | \`${missed.playerTag}\`\n`;
        }
      }
      messages.push({ content: message.replace(/_/g, "\\_") });
    }
  }
  return messages;
};
