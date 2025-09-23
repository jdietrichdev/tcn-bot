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
  try {
    const responses = interaction.message.embeds[0];
    const userId = responses.fields?.splice(5, 1)[0].value;
    const thread = interaction.message.thread!.id;
    const ticketNumber = await getTicketNumber(interaction.guild_id!);
    const applicationChannel = await createApplicationChannel(
      interaction,
      userId!,
      ticketNumber,
      config
    );
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
    console.error(`Failure approving app: ${err}`);
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

const createApplicationChannel = async (
  interaction: APIMessageComponentInteraction,
  userId: string,
  ticketNumber: number,
  config: ServerConfig
) => {
  const username = interaction.message.embeds[0].title?.split(" ")[2];
  const channel = await createChannel(
    {
      name: `\u{1F39F}-${ticketNumber}-${username
        ?.toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")}`,
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
  return channel;
};
