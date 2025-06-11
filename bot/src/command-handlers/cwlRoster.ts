import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getCommandOptionData } from "../util/interaction-util";

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
      const announcementMessages = buildAnnouncement(rosterData.roster, config);
      for (const message of announcementMessages) {
        await sendMessage(message, config.ANNOUNCEMENT_CHANNEL);
      }
      await updateResponse(interaction.application_id, interaction.token, {
        content: "CWL roster announcement sent"
      });
    } else if (notificationType === "Reminder") {
      console.log("Sending roster reminder");
    }
  } catch (err) {
    console.error(`Failed to send roster message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure sending the CWL reminders, please try again",
    });
  }
};

const buildAnnouncement = (roster: Record<string, any>[], config: ServerConfig) => {
  const messages: RESTPostAPIWebhookWithTokenJSONBody[] = []
  messages.push({ content: `<@&${config.CLAN_ROLE}>\nRosters have been set for the upcoming CWL season! Please take a look and feel free to reach out to leads/admins if you have questions about placement or don't see your accounts in the list.` });
  for (const clan of roster) {
    let message = `**${clan.league}**\n${clan.clanTag}\n`;
    for (const player of clan.players) {
      message += `<@${player.userId}> ${player.playerName}\n`;
    }
    messages.push({ content: message, allowed_mentions: { parse: []} });
  }
  return messages;
}