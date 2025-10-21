import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  RESTPostAPIGuildScheduledEventJSONBody,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import {
  createEvent,
  getChannel,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createDiscordTimestamp } from "../util/format-util";
import { channelTypeMap } from "./createEvent";

export const handleScheduleEvent = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const eventId = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "event"
    ).value;
    
    const start = new Date(
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "start"
      ).value
    );
    
    const end = new Date(
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "end"
      ).value
    );

    const eventData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `event#${eventId}`,
          },
        })
      )
    ).Item;

    if (!eventData) {
      throw new Error("Event not found");
    }

    const channel = await getChannel(eventData.channel, interaction.guild_id!);
    
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Use stored event type (Text/Voice/Stage) to determine scheduled event entity type
    const storedType: string = eventData.type || channel.type;

    const entityType = channelTypeMap.get(storedType)?.[1] ?? GuildScheduledEventEntityType.External;
    const createPayload: RESTPostAPIGuildScheduledEventJSONBody = {
      name: eventData.name,
      scheduled_start_time: start.toISOString(),
      scheduled_end_time: end.toISOString(),
      privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
      entity_type: entityType as GuildScheduledEventEntityType,
      description: eventData.description,
      ...(eventData.thumbnail && { image: eventData.thumbnail }),
    } as RESTPostAPIGuildScheduledEventJSONBody;

    if (entityType === GuildScheduledEventEntityType.External) {
      // For external events, provide location metadata (for text channels) if available
      createPayload.entity_metadata = { location: `<#${channel.id}>` };
    } else {
      // For voice/stage event types, require channel_id
      createPayload.channel_id = channel.id;
    }

    await createEvent(createPayload, interaction.guild_id!);

    const updatedMessage = `# ${eventData.name}\n\n` +
      `Start: <t:${createDiscordTimestamp(start.toUTCString())}:F>\n` +
      `End: <t:${createDiscordTimestamp(end.toUTCString())}:F>` +
      (eventData.description ? `\n\nDescription: ${eventData.description}` : '') +
      (eventData.sponsor ? `\n\nThanks to our sponsor <@${eventData.sponsor}>` : '');

    eventData.startTime = start.toISOString();
    eventData.endTime = end.toISOString();
    eventData.scheduled = true;

    await Promise.all([
      sendMessage({ content: updatedMessage }, eventData.channel),
      
      dynamoDbClient.send(
        new PutCommand({
          TableName: "BotTable",
          Item: eventData,
        })
      )
    ]);

    await updateResponse(interaction.application_id, interaction.token, {
      content: `Event "${eventData.name}" has been scheduled! Check <#${eventData.channel}> for details.`,
    });
  } catch (err) {
    console.error(`Failed to schedule event: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure scheduling the event. Please try again or contact an admin.",
    });
  }
};