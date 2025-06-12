import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import {
  deleteMessage,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getCommandOptionData } from "../util/interaction-util";
import { getClan } from "../adapters/coc-api-adapter";
import { WAR_LEAGUE } from "../constants/emojis/coc/cwlLeague";

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
      const announcementMessages = await buildAnnouncement(
        rosterData.roster,
        config
      );
      if (rosterData.previousMessages) {
        for (const messageId of rosterData.previousMessages) {
          await deleteMessage(config.ANNOUNCEMENT_CHANNEL, messageId);
        }
      }
      const previousMessages: string[] = [];
      for (const message of announcementMessages) {
        const { id } = await sendMessage(message, config.ANNOUNCEMENT_CHANNEL);
        if (message.allowed_mentions) {
          await updateMessage(config.ANNOUNCEMENT_CHANNEL, id, {
            content: message.content,
          });
        }
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
        const { id } = await sendMessage(message, config.ANNOUNCEMENT_CHANNEL);
        if (message.allowed_mentions) {
          await updateMessage(config.ANNOUNCEMENT_CHANNEL, id, {
            content: message.content,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await updateResponse(interaction.application_id, interaction.token, {
        content: "CWL roster reminders sent",
      });
    }
  } catch (err) {
    console.error(`Failed to send roster message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure sending the roster information, please try again",
    });
  }
};

const buildAnnouncement = async (
  roster: Record<string, any>[],
  config: ServerConfig
) => {
  const messages: RESTPostAPIWebhookWithTokenJSONBody[] = [];
  messages.push({
    content: `<@&${config.CLAN_ROLE}>\nRosters have been set for the upcoming CWL season! Please take a look and feel free to reach out to leads/admins if you have questions about placement or don't see your accounts in the list.`,
  });
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
      message += `<@${player.userId}> ${player.playerName}\n`;
    }
    messages.push({ content: message, allowed_mentions: { parse: [] } });
  }
  return messages;
};

const buildReminder = async (roster: Record<string, any>[]) => {
  const messages: RESTPostAPIWebhookWithTokenJSONBody[] = [];
  messages.push({
    content:
      "CWL spin is coming soon! Please make sure you are in the right clan and help those that are not!",
  });
  for (const clan of roster) {
    const clanData = await getClan(`#${clan.clanTag}`);
    let message = `# ${
      WAR_LEAGUE[clanData.warLeague.name as keyof typeof WAR_LEAGUE]
    } **${clanData.warLeague.name}**\n## [${
      clanData.name
    }](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${
      clan.clanTag
    }>)\n`;
    const missingPlayers = clan.players.filter(
      (player: Record<string, string>) => {
        return !clanData.memberList.some(
          (member: Record<string, any>) => member.tag === player.playerTag
        );
      }
    );

    for (const player of missingPlayers) {
      message += `<@${player.userId}> ${player.playerName}\n`;
    }
    messages.push({ content: message });
  }
  return messages;
};
