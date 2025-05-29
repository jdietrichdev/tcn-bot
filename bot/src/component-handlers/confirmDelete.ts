import {
  APIEmbed,
  APIGuildTextChannel,
  APIMessage,
  APIMessageComponentInteraction,
  GuildTextChannelType,
} from "discord-api-types/v10";
import {
  deleteChannel,
  getChannelMessages,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getConfig, ServerConfig } from "../util/serverConfig";
import { createDiscordTimestamp } from "../util/format-util";

export const confirmDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const messages = await getChannelMessages(interaction.channel.id);
    messages.reverse();
    const eventMessages = messages.filter((message) => {
      return (
        message.author.id === config.BOT_ID &&
        !message.content.startsWith("You do not have permission") &&
        message.embeds.length === 0 &&
        message.type !== 6
      );
    });
    const transcript = createTranscript(interaction, messages, eventMessages);
    await sendMessage(
      {
        embeds: [transcript],
      },
      config.TRANSCRIPT_CHANNEL
    );
    await deleteChannel(interaction.channel.id);
  } catch (err) {
    console.error(`Failed to delete channel: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue deleting the channel, please try again or reach out to admins",
    });
  }
};

const createTranscript = (
  interaction: APIMessageComponentInteraction,
  messages: APIMessage[],
  eventMessages: APIMessage[]
): APIEmbed => {
  const applicationChannel =
    interaction.channel as APIGuildTextChannel<GuildTextChannelType>;
  const applicantUsername = applicationChannel.name.split("-")[1];
  const applicantId = applicationChannel.topic!.split(":")[1];
  const participantMap = new Map<string, number>();
  for (const message of messages) {
    const author = message.author.id;
    if (!message.author.bot) {
      const score = participantMap.get(author) ?? 0;
      participantMap.set(author, score + 1);
    }
  }
  return {
    title: `Clan application for ${applicantUsername}`,
    fields: [
      {
        name: "Created by",
        value: `<@${applicantId}> <t:${createDiscordTimestamp(
          messages[0].timestamp
        )}:R>`,
        inline: false,
      },
      ...eventMessages.map((message) => {
        const update = message.content;
        let name = "",
          user = "",
          time = "";
        if (update.startsWith("Roles granted")) {
          name = "Roles Granted By";
          user = update.split(" ")[3];
        } else if (update.startsWith("Roles removed")) {
          name = "Roles Removed By";
          user = update.split(" ")[3];
        } else if (update.includes("closed the ticket")) {
          name = "Closed By";
          user = update.split(" ")[0];
        } else if (update.includes("reopened the ticket")) {
          name = "Reopened By";
          user = update.split(" ")[0];
        }
        time = message.timestamp;
        return {
          name,
          value: `${user} <t:${createDiscordTimestamp(time)}:R>`,
          inline: false,
        };
      }),
      {
        name: "Deleted by",
        value: `<@${interaction.member!.user.id}> <t:${createDiscordTimestamp(
          new Date().toUTCString()
        )}:R>`,
        inline: false,
      },
      {
        name: "Participants",
        value: Array.from(participantMap, ([key, value]) => {
          return `${value} messages from <@${key}>`;
        }).join("\n"),
        inline: false,
      },
    ],
  };
};
