import {
  APIApplicationCommandInteractionDataAttachmentOption,
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  ChannelType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import { getCommandOptionData } from "../util/interaction-util";
import {
  createChannel,
  createEvent,
  getAttachment,
  sendMessageWithAttachment,
  updateResponse,
} from "../adapters/discord-adapter";
import { createDiscordTimestamp } from "../util/format-util";
import { v4 as uuidv4 } from "uuid";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const channelTypeMap = new Map<string, Record<string, any>>([
  ["Text", [ChannelType.GuildText, GuildScheduledEventEntityType.External]],
  ["Voice", [ChannelType.GuildVoice, GuildScheduledEventEntityType.Voice]],
  [
    "Stage",
    [ChannelType.GuildStageVoice, GuildScheduledEventEntityType.StageInstance],
  ],
]);

export const handleCreateEvent = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const eventId = uuidv4();
    let attachment: any | null = null;
    let thumbnail: string | null = null;
    const eventData = getEventData(interaction);
    console.log(eventData);
  let scheduledCreated = false;

    if (eventData.start && isNaN(eventData.start.getTime())) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Invalid start time provided. Use format YYYY-MM-DDThh:mm in UTC.",
      });
      return;
    }
    if (eventData.end && isNaN(eventData.end.getTime())) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Invalid end time provided. Use format YYYY-MM-DDThh:mm in UTC.",
      });
      return;
    }
    if (eventData.start && eventData.end && eventData.start >= eventData.end) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Start time must be before end time.",
      });
      return;
    }

    let channel;
    try {
      channel = await createChannel(
        {
          name: eventData.name.toLowerCase().trim().replace(/\s+/g, "-"),
          type: channelTypeMap.get(eventData.type)![0],
          topic: eventId,
          parent_id: config.EVENTS_CATEGORY,
          permission_overwrites: [
            {
              id: interaction.guild_id!,
              type: OverwriteType.Role,
              allow: "0",
              deny: PermissionFlagsBits.ViewChannel.toString(),
            },
            {
              id: config.CLAN_ROLE,
              type: OverwriteType.Role,
              allow: (
                PermissionFlagsBits.ViewChannel |
                PermissionFlagsBits.AddReactions |
                PermissionFlagsBits.SendMessages |
                PermissionFlagsBits.Connect
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
    } catch (err) {
      console.error("Failed to create channel", err);
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "Failed to create the event channel. Please try again or contact an admin.",
      });
      return;
    }

    if (eventData.thumbnail) {
      try {
        const thumbnailUrl =
          interaction.data.resolved!.attachments![eventData.thumbnail].url;

        attachment = await getAttachment(thumbnailUrl);
        thumbnail = `data:image/png;base64,${Buffer.from(
          attachment,
          "binary"
        ).toString("base64")}`;
      } catch (err) {
        console.error("Failed to fetch/attach thumbnail", err);
        attachment = null;
        thumbnail = null;
      }
    }

    if (eventData.start && eventData.end) {
      try {
        await createEvent(
          {
            name: eventData.name,
            scheduled_start_time: eventData.start.toISOString(),
            scheduled_end_time: eventData.end.toISOString(),
            privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
            entity_type: channelTypeMap.get(eventData.type)![1],
            ...(eventData.type === "Text"
              ? { entity_metadata: { location: `<#${channel.id}>` } }
              : { channel_id: channel.id }),
            description: `${eventData.description}${
              eventData.sponsor
                ? `\n\nThanks to our sponsor <@${eventData.sponsor}>!`
                : ""
            }`,
            ...(thumbnail && { image: thumbnail }),
          },
          interaction.guild_id!
        );
        scheduledCreated = true;
      } catch (err) {
        console.error("Failed to create scheduled Discord event", err);
        await updateResponse(interaction.application_id, interaction.token, {
          content:
            "Failed to create the Discord scheduled event. Check bot permissions and event details (times, type).",
        });
        return;
      }
    }

    const eventMessage = createEventMessage(eventData, attachment);
    try {
      await sendMessageWithAttachment(eventMessage, channel.id);
    } catch (err) {
      console.error("Failed to post event message", err);
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "Event channel was created but the bot couldn't post the event message. Check bot permissions in the channel.",
      });
      return;
    }

    const item: Record<string, any> = {
      pk: interaction.guild_id!,
      sk: `event#${eventId}`,
      eventId,
      name: eventData.name,
      description: eventData.description,
      sponsor: eventData.sponsor,
      channel: channel.id,
      type: eventData.type,
      startTime: eventData.start?.toISOString(),
      endTime: eventData.end?.toISOString(),
      thumbnail: eventData.thumbnail,
      scheduled: scheduledCreated,
    };

    try {
      await dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: item,
        })
      );
    } catch (err) {
      console.error("Failed to write event to DB", err);
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "Event channel created and message posted, but failed to save event to the database. Contact an admin.",
      });
      return;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: `Your event has been created, go to <#${channel.id}> to add any additional details you'd like!`,
    });
  } catch (err) {
    console.error(`Failed to create event: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure creating your event, please try again or contact admin",
    });
  }
};

const getEventData = (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  return {
    name: getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "name"
    ).value,
    type: getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "type"
    ).value,
    start: ((): Date | null => {
      const s = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "start"
      )?.value;
      return s ? new Date(s) : null;
    })(),
    end: ((): Date | null => {
      const e = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "end"
      )?.value;
      return e ? new Date(e) : null;
    })(),
    description:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "description"
      )?.value,
    thumbnail:
      getCommandOptionData<APIApplicationCommandInteractionDataAttachmentOption>(
        interaction,
        "thumbnail"
      )?.value,
    sponsor:
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "sponsor"
      )?.value,
  };
};

const createEventMessage = (
  eventData: Record<string, any>,
  thumbnail: any | null
) => {
  const formData = new FormData();

  let message = `# ${eventData.name}`;
  
  if (eventData.start && eventData.end) {
    message = message.concat(
      `\n\nStart: <t:${createDiscordTimestamp(eventData.start.toUTCString())}:F>`
    );
    message = message.concat(
      `\nEnd: <t:${createDiscordTimestamp(eventData.end.toUTCString())}:F>`
    );
  } else {
    message = message.concat("\n\n⏰ *Times to be announced*");
  }

  if (eventData.description)
    message = message.concat(`\n\nDescription: ${eventData.description}`);
  if (eventData.sponsor)
    message = message.concat(
      `\n\nThanks to our sponsor <@${eventData.sponsor}>`
    );

  formData.append("payload_json", JSON.stringify({ content: message }));
  if (thumbnail)
    formData.append(
      "files[0]",
      new Blob([thumbnail], { type: "image/png" }),
      "eventThumbnail.png"
    );
  return formData;
};
