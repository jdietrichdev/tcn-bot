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
} from "../adapters/discord-adapter";

const channelTypeMap = new Map<string, Record<string, any>>([
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
    let thumbnail: string | null = null;
    const eventData = getEventData(interaction);
    console.log(eventData);

    const channel = await createChannel(
      {
        name: eventData.name.toLowerCase().trim().replace(/\s+/g, "-"),
        type: channelTypeMap.get(eventData.type)![0],
        topic: eventData.description || "",
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

    if (eventData.thumbnail) {
      const thumbnailUrl =
        interaction.data.resolved!.attachments![eventData.thumbnail].url;

      const attachment = await getAttachment(thumbnailUrl);
      thumbnail = `data:image/png;base64,${Buffer.from(
        attachment,
        "binary"
      ).toString("base64")}`;
    }

    await createEvent(
      {
        name: eventData.name,
        scheduled_start_time: new Date(`${eventData.start}`).toISOString(),
        scheduled_end_time: new Date(`${eventData.end}`).toISOString(),
        privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
        entity_type: channelTypeMap.get(eventData.type)![1],
        ...(eventData.type === "Text"
          ? { entity_metadata: { location: `<#${channel.id}>` } }
          : { channel_id: channel.id }),
        description: `${eventData.description}`, // Will be based on a couple fields that are passed in
        ...(thumbnail && { image: thumbnail }),
      },
      interaction.guild_id!
    );
  } catch (err) {
    throw err;
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
    start:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "start"
      ).value,
    end: getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "end"
    )?.value,
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
