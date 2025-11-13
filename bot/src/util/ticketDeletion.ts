import {
  APIEmbed,
  APIGuildTextChannel,
  APIMessage,
  ButtonStyle,
  ChannelType,
  ComponentType,
  GuildTextChannelType,
} from "discord-api-types/v10";
import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../clients/s3-client";
import {
  deleteChannel,
  getChannel,
  getChannelMessages,
  getGuildChannels,
  getUser,
  sendMessage,
} from "../adapters/discord-adapter";
import { createDiscordTimestamp } from "./format-util";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { isActorRecruiter } from "../component-handlers/utils";
import {
  getTicketRecruiterStatsRecord,
  incrementRecruitmentPoints,
  recordTicketRecruiterStats,
  TicketRecruiterMessage,
} from "./recruitmentTracker";
import { ServerConfig } from "./serverConfig";

const MAX_CHANNELS_PER_CATEGORY = 50;

interface TicketDeletionOptions {
  guildId: string;
  channelId: string;
  config: ServerConfig;
  deletedById: string;
  deletedByUsername: string;
  channel?: APIGuildTextChannel<GuildTextChannelType>;
  deletionReason?: string;
}

interface ArchiveCleanupOptions {
  triggeredById?: string;
}

interface ParticipantDetails {
  count: number;
  username: string;
}

export const deleteTicketChannel = async (
  options: TicketDeletionOptions
): Promise<void> => {
  const {
    guildId,
    channelId,
    config,
    deletedById,
    deletedByUsername,
    channel: channelInput,
    deletionReason,
  } = options;

  let channel = channelInput;
  if (!channel || channel.type !== ChannelType.GuildText || !channel.topic) {
    const fetchedChannel = await getChannel(channelId);
    if (fetchedChannel.type !== ChannelType.GuildText) {
      throw new Error(
        `Channel ${channelId} is not a guild text channel and cannot be deleted as a ticket.`
      );
    }
    channel = fetchedChannel as APIGuildTextChannel<GuildTextChannelType>;
  }

  const transcriptId = uuidv4();
  const messages = await getChannelMessages(channelId);
  messages.reverse();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: "bot-transcript-bucket",
      Key: `${transcriptId}.json`,
      Body: JSON.stringify(messages),
      ContentType: "application/json",
    })
  );

  const eventMessages = messages.filter((message) => {
    return (
      message.author.id === config.BOT_ID &&
      !message.content.startsWith("You do not have permission") &&
      message.embeds.length === 0 &&
      message.type !== 6
    );
  });

  const {
    embed: transcript,
    participantMap,
    applicantId,
    applicantUsername,
  } = await createTranscript({
    channel,
    messages,
    eventMessages,
    deletedById,
    deletionReason,
  });

  const recruiterMessages = await collectRecruiterMessages(
    guildId,
    participantMap,
    config
  );

  const existingStats = await getTicketRecruiterStatsRecord(
    guildId,
    channelId
  );

  if (!existingStats && recruiterMessages.length > 0) {
    await Promise.all(
      recruiterMessages.map((entry) =>
        incrementRecruitmentPoints(guildId, entry.userId, entry.username, {
          ticketMessages: entry.count,
          points: entry.count * 0.1,
        })
      )
    );
  }

  const totalParticipantMessages = Array.from(participantMap.values()).reduce(
    (sum, details) => sum + details.count,
    0
  );

  await recordTicketRecruiterStats(guildId, {
    ticketChannelId: channel.id,
    ticketChannelName: channel.name ?? undefined,
    ticketNumber: channel.name ? channel.name.split("-")[1] : undefined,
    transcriptId,
    applicantId,
    applicantUsername,
    recruiterMessages,
    totalParticipantMessages,
    closedBy: deletedById,
    closedByUsername: deletedByUsername,
    closedAt: new Date().toISOString(),
  });

  await sendMessage(
    {
      embeds: [transcript],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label: "Transcript",
              url: `https://d19x3gu4qo04f3.cloudfront.net/transcript/${transcriptId}`,
            },
          ],
        },
      ],
    },
    config.TRANSCRIPT_CHANNEL
  );

  await deleteChannel(channelId);
  await removeTicket(guildId, channelId);
};

export const ensureArchiveCapacity = async (
  guildId: string,
  config: ServerConfig,
  options: ArchiveCleanupOptions = {}
): Promise<void> => {
  try {
    let archiveChannels = await fetchArchiveTicketChannels(
      guildId,
      config
    );

    if (archiveChannels.length < MAX_CHANNELS_PER_CATEGORY) {
      return;
    }

    const cleanupReasonBase =
      "Automated cleanup: archive reached Discord's channel limit.";
    const triggerContext = options.triggeredById
      ? ` Triggered by <@${options.triggeredById}> while closing another ticket.`
      : "";

    while (archiveChannels.length >= MAX_CHANNELS_PER_CATEGORY) {
      const channel = archiveChannels[0];
      if (!channel) {
        break;
      }

      try {
        await deleteTicketChannel({
          guildId,
          channelId: channel.id,
          channel,
          config,
          deletedById: config.BOT_ID,
          deletedByUsername: "Auto Cleanup",
          deletionReason: `${cleanupReasonBase}${triggerContext}`.trim(),
        });
      } catch (error) {
        console.error(
          `[ensureArchiveCapacity] Failed to delete archived ticket ${channel.id}: ${error}`
        );
        break;
      }

      archiveChannels = await fetchArchiveTicketChannels(guildId, config);
    }
  } catch (error) {
    console.error(
      `[ensureArchiveCapacity] Unable to ensure archive capacity for guild ${guildId}: ${error}`
    );
  }
};

const fetchArchiveTicketChannels = async (
  guildId: string,
  config: ServerConfig
): Promise<APIGuildTextChannel<GuildTextChannelType>[]> => {
  const channels = await getGuildChannels(guildId);

  return channels
    .filter((channel) => {
      return (
        channel.type === ChannelType.GuildText &&
        channel.parent_id === config.ARCHIVE_CATEGORY &&
        Boolean(channel.topic?.includes("Application channel for"))
      );
    })
    .map(
      (channel) => channel as APIGuildTextChannel<GuildTextChannelType>
    )
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
};

const collectRecruiterMessages = async (
  guildId: string,
  participantMap: Map<string, ParticipantDetails>,
  config: ServerConfig
): Promise<TicketRecruiterMessage[]> => {
  const recruiterChecks = await Promise.all(
    Array.from(participantMap.entries()).map(async ([userId, details]) => {
      try {
        const isRecruiter = await isActorRecruiter(guildId, userId, config);

        if (!isRecruiter) {
          return null;
        }

        return {
          userId,
          username: details.username,
          count: details.count,
        } as TicketRecruiterMessage;
      } catch (error) {
        console.error(
          `Failed to determine recruiter status for ${userId}: ${error}`
        );
        return null;
      }
    })
  );

  return recruiterChecks.filter(
    (entry): entry is TicketRecruiterMessage => entry !== null
  );
};

const createTranscript = async ({
  channel,
  messages,
  eventMessages,
  deletedById,
  deletionReason,
}: {
  channel: APIGuildTextChannel<GuildTextChannelType>;
  messages: APIMessage[];
  eventMessages: APIMessage[];
  deletedById: string;
  deletionReason?: string;
}): Promise<{
  embed: APIEmbed;
  participantMap: Map<string, ParticipantDetails>;
  applicantId: string;
  applicantUsername: string;
}> => {
  const topicParts = channel.topic?.split(":") ?? [];
  const applicantId = topicParts[topicParts.length - 1];
  if (!applicantId) {
    throw new Error(
      `Channel ${channel.id} is missing applicant information in the topic.`
    );
  }

  const applicant = await getUser(applicantId);
  const participantMap = buildParticipantMap(messages);

  const deletionTimestamp = new Date().toISOString();
  const deletionDetails = deletionReason
    ? `${deletionReason}`
    : undefined;

  const embed: APIEmbed = {
    title: `Clan application for ${applicant.username}`,
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
        let name = "";
        let user = "";
        let time = message.timestamp;

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

        return {
          name,
          value: `${user} <t:${createDiscordTimestamp(time)}:R>`,
          inline: false,
        };
      }),
      {
        name: "Deleted by",
        value: `<@${deletedById}> <t:${createDiscordTimestamp(
          deletionTimestamp
        )}:R>${deletionDetails ? `\n${deletionDetails}` : ""}`,
        inline: false,
      },
      {
        name: "Participants",
        value: Array.from(participantMap, ([key, value]) => {
          return `${value.count} messages from <@${key}>`;
        }).join("\n"),
        inline: false,
      },
    ],
  };

  return {
    embed,
    participantMap,
    applicantId,
    applicantUsername: applicant.username,
  };
};

const buildParticipantMap = (messages: APIMessage[]) => {
  const participantMap = new Map<string, ParticipantDetails>();

  for (const message of messages) {
    if (message.author.bot) {
      continue;
    }

    const existing = participantMap.get(message.author.id) ?? {
      count: 0,
      username: message.author.username,
    };

    participantMap.set(message.author.id, {
      count: existing.count + 1,
      username: message.author.username ?? existing.username,
    });
  }

  return participantMap;
};

const removeTicket = async (guildId: string, channelId: string) => {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: "tickets",
      },
    })
  );

  const ticketData = response.Item as { tickets?: Record<string, any>[] } | undefined;
  if (!ticketData || !Array.isArray(ticketData.tickets)) {
    return;
  }

  const updatedTickets = ticketData.tickets.filter(
    (ticket) => ticket.ticketChannel !== channelId
  );

  if (updatedTickets.length === ticketData.tickets.length) {
    return;
  }

  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        ...ticketData,
        tickets: updatedTickets,
        pk: guildId,
        sk: "tickets",
      },
    })
  );
};
