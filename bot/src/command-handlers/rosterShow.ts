import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handleRosterShow = async (
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
        content: "❌ No rosters found. Create one using `/create-roster` first.",
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

    const playerList =
      roster.players && roster.players.length > 0
        ? roster.players
            .map(
              (p: { playerName: string }) =>
                `- ${p.playerName.replace(/_/g, "\\_")}`
            )
            .join("\n")
        : "No players yet";

    const message = `
📋 **Roster Details**

**Clan Name:** ${roster.clanName.replace(/_/g, "\\_")}
**Clan Rank:** ${roster.clanRank}
**Players (${roster.players?.length || 0}):**
${playerList}
    `.trim();

    return updateResponse(interaction.application_id, interaction.token, {
      content: message,
    });
  } catch (error) {
    console.error("Error showing roster:", error);
    console.error("RosterName:", rosterName, "GuildId:", guildId);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while retrieving the roster.",
    });
  }
};
