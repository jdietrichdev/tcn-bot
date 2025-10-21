import { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handleScheduleEventAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  try {
    const focused = interaction.data.options.find(
      (option): option is APIApplicationCommandInteractionDataStringOption & { focused: boolean } => 
        option.name === 'event' && 'focused' in option
    );
    
    if (!focused) return { choices: [] };

    // Query for events in DynamoDB
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": interaction.guild_id,
          ":sk": "event#",
        },
      })
    );

    // Filter for unscheduled events or if searching, match on name
    const events = response.Items?.filter(
      (event) => !event.scheduled && (!focused.value || event.name.toLowerCase().includes(focused.value.toLowerCase()))
    ) || [];

    // Return up to 25 choices (Discord limit)
    return {
      choices: events.slice(0, 25).map((event) => ({
        name: event.name,
        value: event.eventId,
      })),
    };
  } catch (err) {
    console.error("Failed to get events for autocomplete", err);
    return { choices: [] };
  }
};