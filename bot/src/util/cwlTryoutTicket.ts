import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  createChannel,
  getChannel,
  getGuildChannels,
  grantRole,
  sendMessage,
} from "../adapters/discord-adapter";
import { BUTTONS } from "../component-handlers/buttons";
import type { ServerConfig } from "./serverConfig";

export interface CwlTryoutTicketInput {
  guildId: string;
  userId: string;
  username: string;
  playerTag: string;
  targetClan: string;
  signupId: string;
  clanTag: string;
  targetLeague: string;
  previousSeason?: string;
  previousLeague?: string;
  averageStars?: number;
  totalStars?: number;
  attackCount?: number;
  totalDestruction?: number;
  reason: string;
  categoryId: string;
  config: ServerConfig;
}

const activeTicketKey = (
  userId: string,
  playerTag: string,
  categoryId: string
) =>
  `cwlTryout#${userId}#${playerTag.replace(/[^A-Z0-9]/gi, "").toUpperCase()}#${categoryId}`;

const legacyActiveTicketKey = (userId: string, categoryId: string) =>
  `cwlTryout#${userId}#${categoryId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getActiveTicket = async (
  guildId: string,
  userId: string,
  playerTag: string,
  categoryId: string
) => {
  const getChannelId = async (key: string) => {
    const response = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: { pk: guildId, sk: key },
      })
    );
    const responseItem: unknown = response.Item as unknown;
    return isRecord(responseItem) ? responseItem.channelId : undefined;
  };
  const channelId =
    (await getChannelId(activeTicketKey(userId, playerTag, categoryId))) ??
    (await getChannelId(legacyActiveTicketKey(userId, categoryId)));
  if (typeof channelId !== "string") {
    return undefined;
  }
  const guildChannels = await getGuildChannels(guildId);
  const channelExists = guildChannels.some(
    (channel) => channel.id === channelId && channel.parent_id === categoryId
  );
  if (!channelExists) {
    return undefined;
  }
  const channel = await getChannel(channelId);
  if (
    channel.type !== ChannelType.GuildText ||
    channel.parent_id !== categoryId ||
    channel.topic !== `CWL tryout for ${playerTag}:${userId}`
  ) {
    return undefined;
  }
  return channel.id;
};

const recordTicket = async (
  guildId: string,
  channelId: string,
  userId: string,
  playerTag: string,
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
            {
              ticketChannel: channelId,
              userId,
              playerTag,
              type: "cwl-tryout",
            },
        ],
      },
    })
  );
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        pk: guildId,
        sk: activeTicketKey(userId, playerTag, categoryId),
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
    input.playerTag,
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
  const safePlayerTag =
    input.playerTag.replace(/[^a-z0-9]/gi, "").slice(-5).toLowerCase() ||
    "account";
  const addPlayerCustomId =
    `cwl_dashboard_add_player:${input.signupId}:${input.clanTag}:${input.playerTag}`;
  const movePlayerCustomId =
    `cwl_dashboard_move_player:${input.signupId}:${input.clanTag}:${input.playerTag}`;
  if ([...movePlayerCustomId].length > 100) {
    throw new Error("The CWL signup details are too long for a ticket button.");
  }
  const staffRoles = [
    ...new Set([
      ...(input.config.CWL_TRYOUT_STAFF_ROLES ?? []),
      input.config.RECRUITER_ROLE,
      input.config.ADMIN_ROLE,
    ]),
  ]
    .filter(Boolean)
    .map((roleId) => ({
      id: roleId,
      type: OverwriteType.Role,
      allow: (
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.AddReactions |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.ManageMessages |
        PermissionFlagsBits.ManageChannels
      ).toString(),
      deny: "0",
    }));
  const channel = await createChannel(
    {
      name: `cwl-${safeLeague}-${safeUsername}-${safePlayerTag}-${input.userId.slice(-4)}`,
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
        ...(input.config.CWL_TRYOUT_STAFF_ROLES?.length
          ? input.config.CWL_TRYOUT_STAFF_ROLES
          : staffRoles.map((role) => role.id)
        ).map((roleId) => `<@&${roleId}>`),
        `<@${input.userId}> requested a CWL tryout.`,
      ].join(" "),
      embeds: [
        {
          title: "CWL Tryout Request",
          description:
            "Staff review is required before this linked account can be added to the roster.",
          color: 0xd4a017,
          fields: [
            {
              name: "Player",
              value: input.playerTag,
              inline: true,
            },
            {
              name: "Requested roster",
              value: `${input.targetClan} (${input.targetLeague})`,
              inline: true,
            },
            {
              name: "Previous CWL season",
              value: input.previousSeason ?? "Unavailable",
              inline: true,
            },
            {
              name: "Previous CWL league",
              value: input.previousLeague ?? "Unavailable",
              inline: true,
            },
            {
              name: "Average stars",
              value:
                input.averageStars === undefined
                  ? "Unavailable"
                  : `${input.averageStars.toFixed(2)} (${input.totalStars ?? "?"}/${input.attackCount === undefined ? "?" : input.attackCount * 3} stars)`,
              inline: true,
            },
            {
              name: "Total destruction",
              value:
                input.totalDestruction === undefined
                  ? "Unavailable"
                  : `${input.totalDestruction.toFixed(0)}%${
                      input.attackCount
                        ? ` (${(input.totalDestruction / input.attackCount).toFixed(1)}% avg per attack)`
                        : ""
                    }`,
              inline: true,
            },
            {
              name: "Review reason",
              value: input.reason,
              inline: false,
            },
          ],
          footer: {
            text: "The player is not on the roster unless staff add them after review.",
          },
        },
      ],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            BUTTONS.CLOSE_TICKET,
            {
              type: ComponentType.Button,
              style: ButtonStyle.Success,
              label: "Signup Player for Roster",
              custom_id: addPlayerCustomId,
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Danger,
              label: "Deny & Move to Another Clan",
              custom_id: movePlayerCustomId,
            },
          ],
        },
      ],
    },
    channel.id
  );
  await recordTicket(
    input.guildId,
    channel.id,
    input.userId,
    input.playerTag,
    input.categoryId
  );
  if (input.config.CWL_TRYOUT_PENDING_ROLE) {
    try {
      await grantRole(
        input.guildId,
        input.userId,
        input.config.CWL_TRYOUT_PENDING_ROLE
      );
    } catch (error) {
      console.error("Failed to grant CWL Tryout Pending role", error);
    }
  }

  return { channelId: channel.id, created: true };
};
