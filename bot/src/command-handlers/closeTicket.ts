import {
  APIApplicationCommandInteraction,
  APIMessage,
  APITextChannel,
  OverwriteType,
} from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  getChannelMessages,
  getUser,
  moveChannel,
  sendMessage,
  updateChannelPermissions,
  updateResponse,
} from "../adapters/discord-adapter";
import { isActorAdmin, isActorRecruiter } from "../component-handlers/utils";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  getTicketRecruiterStatsRecord,
  incrementRecruitmentPoints,
  saveTicketRecruiterStats,
  TicketRecruiterMessage,
} from "../util/recruitmentTracker";
import { ensureArchiveCapacity } from "../util/ticketDeletion";

export const closeTicket = async (
  interaction: APIApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    if (await isTicketChannel(interaction)) {
      if (
        await isActorRecruiter(
          interaction.guild_id!,
          interaction.member!.user.id,
          config
        ) || await isActorAdmin(interaction.guild_id!, interaction.member!.user.id, config)
      ) {
        const channelId = interaction.channel.id;
        await recordTicketStatsIfNeeded(interaction, config);
        const userId = (interaction.channel as APITextChannel).topic!.split(
          ":"
        )[1];
        await ensureArchiveCapacity(interaction.guild_id!, config, {
          triggeredById: interaction.member?.user.id,
        });
        await moveChannel(channelId, config.ARCHIVE_CATEGORY);
        await updateChannelPermissions(channelId, userId, {
          type: OverwriteType.Member,
          allow: "0",
          deny: "0",
        });
        await sendMessage(
          {
            content: `${interaction.member?.user.username} has closed the ticket`,
          },
          channelId
        );
        await ensureArchiveCapacity(interaction.guild_id!, config, {
          triggeredById: interaction.member?.user.id,
        });
      } else {
        await sendMessage(
          {
            content: `You do not have permission to close this ticket <@${interaction.member?.user.id}>`,
          },
          interaction.channel.id
        );
      }
    } else {
      await sendMessage(
        {
          content: `This is not an application channel <@${
            interaction.member!.user.id
          }>`,
        },
        interaction.channel.id
      );
    }
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failed to close ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue closing this ticket, please try again or reach out to admins",
    });
  }
};

const isTicketChannel = async (interaction: APIApplicationCommandInteraction) => {
  const ticketData = (await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id!,
        sk: 'tickets'
      }
    })
  )).Item!;

  if (ticketData.tickets.find((ticket: Record<string, any>) => ticket.ticketChannel === interaction.channel.id)) {
    return true;
  } else {  
    return interaction.channel.name!.includes("\u{1F39F}") 
    || interaction.channel.name!.includes("\u{2705}");
  }
};

interface ParticipantDetails {
  count: number;
  username: string;
}

const recordTicketStatsIfNeeded = async (
  interaction: APIApplicationCommandInteraction,
  config: ServerConfig
) => {
  try {
    const existing = await getTicketRecruiterStatsRecord(
      interaction.guild_id!,
      interaction.channel.id
    );
    if (existing) {
      return;
    }

    const messages = await getChannelMessages(interaction.channel.id);
    const participantMap = buildParticipantMap(messages);
    const recruiterMessages = await collectRecruiterMessagesForClose(
      interaction,
      participantMap,
      config
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
              points: entry.count * 0.1,
            }
          )
        )
      );
    }

    const totalParticipantMessages = Array.from(participantMap.values()).reduce(
      (sum, details) => sum + details.count,
      0
    );

    const applicationChannel = interaction.channel as APITextChannel;
    const applicantId = applicationChannel.topic?.split(":")[1];
    let applicantUsername = applicantId ?? "unknown";
    if (applicantId) {
      try {
        const applicant = await getUser(applicantId);
        applicantUsername = applicant.username ?? applicantId;
      } catch (err) {
        console.error(
          `Failed to fetch applicant user ${applicantId} during closeTicket stats recording: ${err}`
        );
      }
    }

    await saveTicketRecruiterStats(
      interaction.guild_id!,
      new Date().toISOString(),
      interaction.channel.id,
      {
        ticketChannelId: interaction.channel.id,
        ticketChannelName:
          "name" in interaction.channel && interaction.channel.name
            ? interaction.channel.name
            : undefined,
        ticketNumber:
          "name" in interaction.channel && interaction.channel.name
            ? interaction.channel.name.split("-")[1]
            : undefined,
        transcriptId: `pending-${interaction.channel.id}`,
        applicantId: applicantId ?? "unknown",
        applicantUsername,
        recruiterMessages,
        totalParticipantMessages,
        closedBy: interaction.member!.user.id,
        closedByUsername:
          interaction.member!.user.username ?? interaction.member!.user.id,
        closedAt: new Date().toISOString(),
      }
    );
  } catch (err) {
    console.error(
      `Failed to record ticket recruiter stats during closeTicket: ${err}`
    );
  }
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

const collectRecruiterMessagesForClose = async (
  interaction: APIApplicationCommandInteraction,
  participantMap: Map<string, ParticipantDetails>,
  config: ServerConfig
): Promise<TicketRecruiterMessage[]> => {
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
          `Failed to determine recruiter status for ${userId} during closeTicket: ${error}`
        );
        return null;
      }
    })
  );

  return recruiterChecks.filter(
    (entry): entry is TicketRecruiterMessage => entry !== null
  );
};
