import {
  APIEmbed,
  APIGuildTextChannel,
  APIMessage,
  APIMessageComponentInteraction,
  ButtonStyle,
  ComponentType,
  GuildTextChannelType,
} from "discord-api-types/v10";
import {
  deleteChannel,
  getChannelMessages,
  getUser,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import { createDiscordTimestamp } from "../util/format-util";
import { v4 as uuidv4 } from "uuid";
import { s3Client } from "../clients/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { isActorRecruiter } from "./utils";
import {
  incrementRecruitmentPoints,
  recordTicketRecruiterStats,
  TicketRecruiterMessage,
} from "../util/recruitmentTracker";

export const confirmDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const transcriptId = uuidv4();
    const messages = await getChannelMessages(interaction.channel.id);
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
    } = await createTranscript(
      interaction,
      messages,
      eventMessages
    );

    const recruiterMessages = await collectRecruiterMessages(
      interaction,
      participantMap
    );

    if (recruiterMessages.length > 0) {
      await Promise.all(
        recruiterMessages.map((entry) =>
          incrementRecruitmentPoints(
            interaction.guild_id!,
            entry.userId,
            entry.username,
            {
              ticketMessages: entry.count,
            }
          )
        )
      );
    }

    const totalParticipantMessages = Array.from(participantMap.values()).reduce(
      (sum, details) => sum + details.count,
      0
    );

    await recordTicketRecruiterStats(interaction.guild_id!, {
      ticketChannelId: interaction.channel.id,
      ticketChannelName:
        "name" in interaction.channel && interaction.channel.name
          ? interaction.channel.name
          : undefined,
      ticketNumber:
        "name" in interaction.channel && interaction.channel.name
          ? interaction.channel.name.split("-")[1]
          : undefined,
      transcriptId,
      applicantId,
      applicantUsername,
      recruiterMessages,
      totalParticipantMessages,
      closedBy: interaction.member!.user.id,
      closedByUsername: interaction.member!.user.username ??
        interaction.member!.user.id,
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
    await deleteChannel(interaction.channel.id);
    await removeTicket(interaction.guild_id!, interaction.channel.id);
  } catch (err) {
    console.error(`Failed to delete channel: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue deleting the channel, please try again or reach out to admins",
    });
  }
};

interface ParticipantDetails {
  count: number;
  username: string;
}

const collectRecruiterMessages = async (
  interaction: APIMessageComponentInteraction,
  participantMap: Map<string, ParticipantDetails>
): Promise<TicketRecruiterMessage[]> => {
  const config = getConfig(interaction.guild_id!);

  const recruiterChecks = await Promise.all(
    Array.from(participantMap.entries()).map(async ([userId, details]) => {
      try {
        const isRecruiter = await isActorRecruiter(
          interaction.guild_id!,
          userId,
          config
        );

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

const createTranscript = async (
  interaction: APIMessageComponentInteraction,
  messages: APIMessage[],
  eventMessages: APIMessage[]
): Promise<{
  embed: APIEmbed;
  participantMap: Map<string, ParticipantDetails>;
  applicantId: string;
  applicantUsername: string;
}> => {
  const applicationChannel =
    interaction.channel as APIGuildTextChannel<GuildTextChannelType>;
  const applicantId = applicationChannel.topic!.split(":")[1];
  const applicant = await getUser(applicantId);
  const participantMap = new Map<string, ParticipantDetails>();
  for (const message of messages) {
    const author = message.author.id;
    if (!message.author.bot) {
      const existing = participantMap.get(author) ?? {
        count: 0,
        username: message.author.username,
      };
      participantMap.set(author, {
        count: existing.count + 1,
        username: message.author.username ?? existing.username,
      });
    }
  }
  return {
    embed: {
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
          return `${value.count} messages from <@${key}>`;
        }).join("\n"),
        inline: false,
      },
    ],
    },
    participantMap,
    applicantId,
    applicantUsername: applicant.username,
  };
};

const removeTicket = async (guildId: string, channelId: string) => {
  const ticketData = (
    await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: {
          pk: guildId,
          sk: "tickets",
        },
      })
    )
  ).Item!;
  ticketData.tickets = ticketData.tickets.filter(
    (ticket: Record<string, any>) => ticket.ticketChannel !== channelId
  );
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: ticketData,
    })
  );
};
