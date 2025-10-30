import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export const handleRosterDelete = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  const rosterNameOption = interaction.data.options?.find(
    (opt) => opt.name === "roster-name"
  ) as APIApplicationCommandInteractionDataStringOption;
  const rosterName = rosterNameOption?.value;

  if (!guildId) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ This command can only be used in a server.",
    });
  }

  if (!rosterName) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Roster name is required.",
    });
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

    const playerCount = roster.players?.length || 0;

    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: "BotTable",
        Key: {
          pk: roster.pk,
          sk: roster.sk,
        },
      })
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `✅ Successfully deleted roster **${rosterName}** (Rank ${roster.clanRank}) and removed ${playerCount} player${playerCount !== 1 ? 's' : ''}.`,
    });

    if (roster.players && Array.isArray(roster.players) && roster.players.length > 0) {
      try {
        console.log(`Refreshing unrostered lists after deleting roster with ${roster.players.length} players`);
        const { refreshUnrosteredMessagesAddPlayer } = await import('../component-handlers/unrosteredButton');
        
        for (const player of roster.players) {
          if (player.playerName) {
            console.log(`Adding back player: ${player.playerName}`);
            await refreshUnrosteredMessagesAddPlayer(player.playerName);
          }
        }
        console.log('Refresh completed after roster deletion');
      } catch (error) {
        console.error('Failed to refresh unrostered messages after roster deletion:', error);
      }
    }
  } catch (err) {
    console.error("Failed to delete roster:", err);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Failed to delete roster. Please try again or contact an admin.",
    });
  }
};
