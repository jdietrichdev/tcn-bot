import {
  APIApplicationCommandInteractionDataAttachmentOption,
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  GuildScheduledEventEntityType,
} from "discord-api-types/v10";
// import { getConfig } from "../util/serverConfig";
import { getCommandOptionData } from "../util/interaction-util";
import { createEvent, getAttachment } from "../adapters/discord-adapter";

export const handleCreateEvent = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    // const config = getConfig(interaction.guild_id!);
    let thumbnail: string | null = null;
    const eventData = getEventData(interaction);
    console.log(eventData);

    if (eventData.thumbnail) {
      const thumbnailUrl =
        interaction.data.resolved!.attachments![eventData.thumbnail].url;
      console.log(thumbnailUrl);

      const attachment = await getAttachment(thumbnailUrl);
      thumbnail = `data:image/png;base64,${Buffer.from(attachment).toString('base64')}`
      console.log(thumbnail);
    }

    await createEvent({
      name: eventData.name,
      scheduled_start_time: new Date(`${eventData.start}`).toISOString(),
      ...(eventData.end && { scheduled_end_time: new Date(`${eventData.end}`).toISOString() }),
      privacy_level: 2,
      entity_type: GuildScheduledEventEntityType.External, // Needs to be dependent on type passed
      channel_id: undefined, // Will be dependent on type passed
      description: "Test Description", // Will be based on a couple fields that are passed in
      ...(thumbnail && { image: thumbnail }),
    }, interaction.guild_id!);
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
    )?.value,
    channelType:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "type"
      )?.value,
    start:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "start"
      )?.value,
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
