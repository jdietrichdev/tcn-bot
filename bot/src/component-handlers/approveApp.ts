import {
  APIMessageComponentInteraction,
  ChannelType,
  ComponentType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  createChannel,
  deleteResponse,
  pinMessage,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { BUTTONS } from "./buttons";
import { determineRolesButton } from "./utils";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const approveApp = async (
  interaction: APIMessageComponentInteraction,
  config: ServerConfig
) => {
  console.log(`[approveApp] Starting approval process for message: ${interaction.message.id}`);
  try {
    console.log(`[approveApp] Extracting data from message embeds`);
    const responses = interaction.message.embeds[0];
    console.log(`[approveApp] Embed title: ${responses.title}`);
    console.log(`[approveApp] Embed fields count: ${responses.fields?.length}`);
    const userId = responses.fields?.splice(5, 1)[0].value;
    console.log(`[approveApp] Extracted userId: ${userId}`);
    const thread = interaction.message.thread!.id;
    console.log(`[approveApp] Thread ID: ${thread}`);
    console.log(`[approveApp] Getting ticket number for guild: ${interaction.guild_id}`);
    const ticketNumber = await getTicketNumber(interaction.guild_id!);
    console.log(`[approveApp] Ticket number: ${ticketNumber}`);
    console.log(`[approveApp] Creating application channel`);
    const applicationChannel = await createApplicationChannel(
      interaction,
      userId!,
      ticketNumber,
      config
    );
    console.log(`[approveApp] Application channel created: ${applicationChannel.id}`);
    delete responses.footer;
    const message = await sendMessage(
      {
        content: `<@&${config.RECRUITER_ROLE}>\nHey <@${userId}> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!\n<#${thread}>`,
        embeds: [responses],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              BUTTONS.CLOSE_TICKET,
              BUTTONS.DELETE_TICKET,
              await determineRolesButton(
                interaction.guild_id!,
                userId!,
                config
              ),
            ],
          },
        ],
      },
      applicationChannel.id
    );
    await pinMessage(message.channel_id, message.id);
    await addTicket(interaction.guild_id!, applicationChannel.id, userId!);
    await updateMessage(interaction.channel.id, interaction.message.id, {
      content: `Accepted by ${interaction.member?.user.username}\n<#${applicationChannel.id}>`,
      components: [],
    });
    await sendMessage(
      { content: `Application Channel: <#${applicationChannel.id}>` },
      thread
    );
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`[approveApp] Failure approving app: ${err}`);
    console.error(`[approveApp] Stack trace:`, err instanceof Error ? err.stack : err);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue approving this application, if a channel has not been created please try again or reach out to admins",
    });
  }
};

const getTicketNumber = async (guildId: string) => {
  try {
    let ticketNumber = 1;
    const response = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: {
          pk: guildId,
          sk: "ticketNumber",
        },
      })
    );

    if (response.Item) {
      ticketNumber = response.Item.number;
    }

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: {
          pk: guildId,
          sk: "ticketNumber",
          number: ticketNumber + 1,
        },
      })
    );

    return ticketNumber;
  } catch (err) {
    throw new Error(`Failure fetching next ticket number: ${err}`);
  }
};

const addTicket = async (guildId: string, ticketChannel: string, userId: string) => {
  console.log(`[addTicket] Adding ticket for guild: ${guildId}, channel: ${ticketChannel}, user: ${userId}`);
  const ticketData = (await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: 'tickets'
      }
    })
  )).Item;

  if (!ticketData) {
    console.error(`[addTicket] No ticket data found for guild: ${guildId}`);
    throw new Error(`No ticket data found for guild ${guildId}`);
  }

  console.log(`[addTicket] Current tickets count: ${ticketData.tickets?.length || 0}`);
  ticketData.tickets = ticketData.tickets || [];
  ticketData.tickets.push({ ticketChannel, userId });

  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: ticketData
    })
  );
  console.log(`[addTicket] Successfully added ticket`);
}

const createApplicationChannel = async (
  interaction: APIMessageComponentInteraction,
  userId: string,
  ticketNumber: number,
  config: ServerConfig
) => {
  console.log(`[createApplicationChannel] Creating channel for user: ${userId}, ticket: ${ticketNumber}`);
  const username = interaction.message.embeds[0].title?.split(" ")[2];
  console.log(`[createApplicationChannel] Extracted username: ${username}`);
  if (!username) {
    console.error(`[createApplicationChannel] Failed to extract username from embed title: ${interaction.message.embeds[0].title}`);
  }
  console.log(`[createApplicationChannel] Building channel name with username: '${username}'`);
  const sanitizedUsername = username
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]/g, "") || "unknown";
  const channelName = `\u{1F39F}-${ticketNumber}-${sanitizedUsername}`;
  console.log(`[createApplicationChannel] Channel name: ${channelName}`);

  const channel = await createChannel(
    {
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Application channel for ${username}:${userId}`,
      parent_id: config.APPLICATION_CATEGORY,
      permission_overwrites: [
        {
          id: interaction.guild_id!,
          type: OverwriteType.Role,
          allow: "0",
          deny: PermissionFlagsBits.ViewChannel.toString(),
        },
        {
          id: config.RECRUITER_ROLE,
          type: OverwriteType.Role,
          allow: (
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.AddReactions |
            PermissionFlagsBits.SendMessages
          ).toString(),
          deny: "0",
        },
        {
          id: userId,
          type: OverwriteType.Member,
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
  console.log(`[createApplicationChannel] Channel created successfully: ${channel.id}`);
  return channel;
};
