import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  createChannel,
  getGuildChannels,
  sendMessage,
} from "../adapters/discord-adapter";
import type { ServerConfig } from "./serverConfig";

export interface CwlTryoutTicketInput {
  guildId: string;
  userId: string;
  username: string;
  playerTag: string;
  targetClan: string;
  targetLeague: string;
  previousSeason?: string;
  previousLeague?: string;
  averageStars?: number;
  reason: string;
  categoryId: string;
  config: ServerConfig;
}

const activeTicketKey = (userId: string, categoryId: string) =>
  `cwlTryout#${userId}#${categoryId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getActiveTicket = async (
  guildId: string,
  userId: string,
  categoryId: string
) => {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: activeTicketKey(userId, categoryId),
      },
    })
  );
  const responseItem: unknown = response.Item as unknown;
  const channelId = isRecord(responseItem)
    ? responseItem.channelId
    : undefined;
  if (typeof channelId !== "string") {
    return undefined;
  }
  const channels = await getGuildChannels(guildId);
  return channels.find(
    (channel) => channel.id === channelId && channel.parent_id === categoryId
  )?.id;
};

const recordTicket = async (
  guildId: string,
  channelId: string,
  userId: string,
  categoryId: string
) => {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: { pk: guildId, sk: "tickets" },
    })
  );
  const responseItem: unknown = response.Item as unknown;
  const ticketData = isRecord(responseItem)
    ? responseItem
    : { pk: guildId, sk: "tickets" };
  const existingTickets = ticketData.tickets;
  const tickets = Array.isArray(existingTickets)
    ? existingTickets.filter(isRecord)
    : [];
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        ...ticketData,
        tickets: [
          ...tickets,
          { ticketChannel: channelId, userId, type: "cwl-tryout" },
        ],
      },
    })
  );
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        pk: guildId,
        sk: activeTicketKey(userId, categoryId),
        channelId,
      },
    })
  );
};

export const createCwlTryoutTicket = async (
  input: CwlTryoutTicketInput
): Promise<{ channelId: string; created: boolean }> => {
  const existingTicket = await getActiveTicket(
    input.guildId,
    input.userId,
    input.categoryId
  );
  if (existingTicket) {
    return { channelId: existingTicket, created: false };
  }

  const safeUsername =
    input.username.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) ||
    "player";
  const safeLeague =
    input.targetLeague.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24) ||
    "review";
  const staffRoles = [...new Set([input.config.RECRUITER_ROLE, input.config.ADMIN_ROLE])]
    .filter(Boolean)
    .map((roleId) => ({
      id: roleId,
      type: OverwriteType.Role,
      allow: (
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.AddReactions |
        PermissionFlagsBits.SendMessages
      ).toString(),
      deny: "0",
    }));
  const channel = await createChannel(
    {
      name: `cwl-${safeLeague}-${safeUsername}-${input.userId.slice(-4)}`,
      type: ChannelType.GuildText,
      topic: `CWL tryout for ${input.playerTag}:${input.userId}`,
      parent_id: input.categoryId,
      permission_overwrites: [
        {
          id: input.guildId,
          type: OverwriteType.Role,
          allow: "0",
          deny: PermissionFlagsBits.ViewChannel.toString(),
        },
        ...staffRoles,
        {
          id: input.config.BOT_ID,
          type: OverwriteType.Member,
          allow: (
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.AddReactions |
            PermissionFlagsBits.SendMessages
          ).toString(),
          deny: "0",
        },
        {
          id: input.userId,
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
    input.guildId
  );

  await sendMessage(
    {
      content: [
        ...staffRoles.map((role) => `<@&${role.id}>`),
        `<@${input.userId}> requested a CWL tryout.`,
        `**Player:** ${input.playerTag}`,
        `**Signup clan:** ${input.targetClan} (${input.targetLeague})`,
        `**Previous CWL season:** ${input.previousSeason ?? "Unavailable"}`,
        `**Previous CWL league:** ${input.previousLeague ?? "Unavailable"}`,
        `**Previous average stars:** ${
          input.averageStars === undefined
            ? "Unavailable"
            : input.averageStars.toFixed(2)
        }`,
        `**Review reason:** ${input.reason}`,
        "The player has not been added to the roster. Staff can add the linked tag from the CWL dashboard after review.",
      ].join("\n"),
    },
    channel.id
  );
  await recordTicket(
    input.guildId,
    channel.id,
    input.userId,
    input.categoryId
  );

  return { channelId: channel.id, created: true };
};
