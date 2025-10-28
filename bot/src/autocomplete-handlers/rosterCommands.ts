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

  console.log("RosterAdd autocomplete - focused:", focused?.name, "value:", focused?.value);

  if (!focused || !guildId) {
    console.log("RosterAdd autocomplete - missing focused or guildId");
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    if (focused.name === "player-name") {
      const allPlayers = await fetchUnrosteredPlayersFromCSV();
      
      const filteredPlayers = focused.value 
        ? allPlayers.filter((player) =>
            player.toLowerCase().includes(focused.value.toLowerCase())
          )
        : allPlayers;

      options.choices = filteredPlayers.slice(0, 25).map((player) => ({
        name: player,
        value: player,
      }));
    }

    if (focused.name === "roster-name") {
      const queryResult = await dynamoDbClient.send(
        new QueryCommand({
          TableName: "BotTable",
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": guildId,
            ":sk": "roster#",
          },
        })
      );

      const rosters = queryResult.Items || [];
      console.log("Found rosters:", rosters.length);
      
      const filteredRosters = focused.value
        ? rosters.filter((roster) =>
            roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
          )
        : rosters;

      options.choices = filteredRosters.slice(0, 25).map((roster) => ({
        name: `${roster.clanName} (Rank: ${roster.clanRank})`,
        value: roster.clanName,
      }));
    }
  } catch (error) {
    console.error("Error in roster-add autocomplete:", error);
  }

  console.log("RosterAdd autocomplete - returning choices:", options.choices?.length || 0);
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

  console.log("RosterShow autocomplete - focused:", focused?.name, "value:", focused?.value);

  if (!focused || !guildId || focused.name !== "roster-name") {
    console.log("RosterShow autocomplete - missing focused or guildId or not roster-name");
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "roster#",
        },
      })
    );

    const rosters = queryResult.Items || [];
    console.log("Found rosters:", rosters.length);
    
    const filteredRosters = focused.value
      ? rosters.filter((roster) =>
          roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
        )
      : rosters;

    options.choices = filteredRosters.slice(0, 25).map((roster) => ({
      name: `${roster.clanName} (Rank: ${roster.clanRank})`,
      value: roster.clanName,
    }));
  } catch (error) {
    console.error("Error in roster-show autocomplete:", error);
  }

  console.log("RosterShow autocomplete - returning choices:", options.choices?.length || 0);
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

  console.log("RosterRemove autocomplete - focused:", focused?.name, "value:", focused?.value);

  if (!focused || !guildId) {
    console.log("RosterRemove autocomplete - missing focused or guildId");
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "roster#",
        },
      })
    );

    const rosters = queryResult.Items || [];
    console.log("Found rosters:", rosters.length);

    if (focused.name === "roster-name") {
      const filteredRosters = focused.value
        ? rosters.filter((roster) =>
            roster.clanName?.toLowerCase().includes(focused.value.toLowerCase())
          )
        : rosters;

      options.choices = filteredRosters.slice(0, 25).map((roster) => ({
        name: `${roster.clanName} (Rank: ${roster.clanRank})`,
        value: roster.clanName,
      }));
    }

    if (focused.name === "player-name") {
      const rosterNameOption = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
        (opt) => opt.name === "roster-name"
      );

      console.log("RosterRemove autocomplete - roster-name option:", rosterNameOption?.value);

      if (rosterNameOption?.value) {
        const roster = rosters.find(
          (r) => r.clanName?.toLowerCase() === rosterNameOption.value.toLowerCase()
        );

        console.log("RosterRemove autocomplete - found roster:", roster?.clanName, "players:", roster?.players?.length);

        if (roster?.players && Array.isArray(roster.players)) {
          const filteredPlayers = focused.value
            ? roster.players.filter(
                (p: { playerName: string }) =>
                  p.playerName.toLowerCase().includes(focused.value.toLowerCase())
              )
            : roster.players;

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

  console.log("RosterRemove autocomplete - returning choices:", options.choices?.length || 0);
  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
