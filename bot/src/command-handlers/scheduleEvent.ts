import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
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

    await createEvent(
      {
        name: eventData.name,
        scheduled_start_time: start.toISOString(),
        scheduled_end_time: end.toISOString(),
        privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
        entity_type: channelTypeMap.get(channel.type)![1],
        ...(channel.type === "GUILD_TEXT"
          ? { entity_metadata: { location: `<#${channel.id}>` } }
          : { channel_id: channel.id }),
        description: eventData.description,
        ...(eventData.thumbnail && { image: eventData.thumbnail }),
      },
      interaction.guild_id!
    );

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