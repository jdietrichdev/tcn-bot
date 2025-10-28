import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: "❌ No rosters found.",
      });
    }

    const roster = queryResult.Items.find(
      (item) => item.clanName?.toLowerCase() === rosterName.toLowerCase()
    );

    if (!roster) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ Roster "${rosterName}" not found. Use autocomplete to see available rosters.`,
      });
    }

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
        TableName: process.env.TABLE_NAME,
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
  } catch (error) {
    console.error("Error removing player from roster:", error);
    console.error("PlayerName:", playerName, "RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while removing the player from the roster.",
    });
  }
};
