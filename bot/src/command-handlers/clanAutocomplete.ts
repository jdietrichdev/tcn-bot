import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandAutocompleteResponse,
  ApplicationCommandOptionType,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { updateResponse } from "adapters/discord-adapter";

interface ClanItem {
  pk: string;
  clanName: string;
}

export const handleClanAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const focusedOption = interaction.data.options.find(
    (option) => (option as any).focused
  );

  if (focusedOption?.name !== "clan") {
    return; 
  }

  const queryResult = await dynamoDbClient.send(
    new QueryCommand({
      TableName: "BotTable",
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": "clans",
      },
    })
  );

  const clans = (queryResult.Items as ClanItem[]) ?? [];
  const choices = clans.map((clan) => ({
    name: clan.clanName,
    value: clan.clanName,
  }));

  const response: APIApplicationCommandAutocompleteResponse = {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: {
      choices: choices,
    },
  };

  
  console.log("Autocomplete Response:", JSON.stringify(response));
};