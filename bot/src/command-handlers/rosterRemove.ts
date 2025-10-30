import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { fetchPlayersWithDetailsFromCSV } from '../util/fetchUnrosteredPlayersCSV';
import { refreshUnrosteredMessages } from '../component-handlers/unrosteredButton';
import { getPlayerCWLLeague, getPlayerWarHitRate } from '../adapters/clashking-adapter';
import { fetchCWLResponses } from '../util/fetchCWLResponses';

export const handleRosterRemove = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  const playerNameOption = interaction.data.options?.find(
    (opt) => opt.name === "player-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const rosterNameOption = interaction.data.options?.find(
    (opt) => opt.name === "roster-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const playerName = playerNameOption?.value;
  const rosterName = rosterNameOption?.value;

  if (!guildId) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ This command can only be used in a server.",
    });
  }

  if (!playerName || !rosterName) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Player name and roster name are required.",
    });
  }

  try {
    console.log(`RosterRemove: Looking for roster "${rosterName}" and player "${playerName}"`);
    
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

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: "❌ No rosters found.",
      });
    }

    console.log(`RosterRemove: Found ${queryResult.Items.length} rosters`);
    console.log(`RosterRemove: Roster names:`, queryResult.Items.map(r => r.clanName));

    const roster = queryResult.Items.find(
      (item) => item.clanName?.toLowerCase() === rosterName.toLowerCase()
    );

    if (!roster) {
      const availableRosters = queryResult.Items
        .map((r) => `**${r.clanName}**`)
        .join(', ');
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Roster "${rosterName}" not found.\n\nAvailable rosters: ${availableRosters}`,
      });
    }

    console.log(`RosterRemove: Found roster "${roster.clanName}" with ${roster.players?.length || 0} players`);

    const playerIndex = roster.players?.findIndex(
      (p: { playerName: string }) =>
        p.playerName.toLowerCase() === playerName.toLowerCase()
    );

    if (playerIndex === -1 || playerIndex === undefined) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Player "${playerName}" is not in the roster "${rosterName}".`,
      });
    }

    const updatedPlayers = [...roster.players];
    updatedPlayers.splice(playerIndex, 1);

    await dynamoDbClient.send(
      new UpdateCommand({
        TableName: "BotTable",
        Key: {
          pk: roster.pk,
          sk: roster.sk,
        },
        UpdateExpression: "SET players = :players",
        ExpressionAttributeValues: {
          ":players": updatedPlayers,
        },
      })
    );

    return updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Successfully removed **${playerName.replace(
        /_/g,
        "\\_"
      )}** from roster **${rosterName.replace(/_/g, "\\_")}**.`,
    });
    
    try {
      console.log(`Quick add refresh: adding ${playerName} back to unrostered lists`);
      const { refreshUnrosteredMessagesAddPlayer } = await import('../component-handlers/unrosteredButton');
      await refreshUnrosteredMessagesAddPlayer(playerName);
      console.log('Quick add refresh completed');
    } catch (error) {
      console.error('Failed to refresh unrostered messages:', error);
    }
  } catch (error) {
    console.error("Error removing player from roster:", error);
    console.error("PlayerName:", playerName, "RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while removing the player from the roster.",
    });
  }
};
