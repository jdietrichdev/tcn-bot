import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchUnrosteredPlayersFromCSV } from "../util/fetchUnrosteredPlayersCSV";

export const handleRosterAdd = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId) {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    if (focused.name === "player-name") {
      const allPlayers = await fetchUnrosteredPlayersFromCSV();
      
      const filteredPlayers = allPlayers.filter((player) =>
        player.toLowerCase().includes(focused.value.toLowerCase())
      );

      options.choices = filteredPlayers.slice(0, 25).map((player) => ({
        name: player,
        value: player,
      }));
    }

    if (focused.name === "roster-name") {
      const queryResult = await dynamoDbClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": guildId,
            ":sk": "roster#",
          },
        })
      );

      const rosters = queryResult.Items || [];
      
      const filteredRosters = rosters.filter((roster) =>
        roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
      );

      options.choices = filteredRosters.slice(0, 25).map((roster) => ({
        name: `${roster.clanName} (Rank: ${roster.clanRank})`,
        value: roster.clanName,
      }));
    }
  } catch (error) {
    console.error("Error in roster-add autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleRosterShow = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId || focused.name !== "roster-name") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "roster#",
        },
      })
    );

    const rosters = queryResult.Items || [];
    
    const filteredRosters = rosters.filter((roster) =>
      roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
    );

    options.choices = filteredRosters.slice(0, 25).map((roster) => ({
      name: `${roster.clanName} (Rank: ${roster.clanRank})`,
      value: roster.clanName,
    }));
  } catch (error) {
    console.error("Error in roster-show autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleRosterRemove = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId) {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "roster#",
        },
      })
    );

    const rosters = queryResult.Items || [];

    if (focused.name === "roster-name") {
      const filteredRosters = rosters.filter((roster) =>
        roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
      );

      options.choices = filteredRosters.slice(0, 25).map((roster) => ({
        name: `${roster.clanName} (Rank: ${roster.clanRank})`,
        value: roster.clanName,
      }));
    }

    if (focused.name === "player-name") {
      const rosterNameOption = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
        (opt) => opt.name === "roster-name"
      );

      if (rosterNameOption?.value) {
        const roster = rosters.find(
          (r) => r.clanName?.toLowerCase() === rosterNameOption.value.toLowerCase()
        );

        if (roster?.players && Array.isArray(roster.players)) {
          const filteredPlayers = roster.players.filter(
            (p: { playerName: string }) =>
              p.playerName.toLowerCase().includes(focused.value.toLowerCase())
          );

          options.choices = filteredPlayers.slice(0, 25).map((p: { playerName: string }) => ({
            name: p.playerName,
            value: p.playerName,
          }));
        }
      }
    }
  } catch (error) {
    console.error("Error in roster-remove autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
