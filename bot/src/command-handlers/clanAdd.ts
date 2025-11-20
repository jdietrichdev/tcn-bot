import { CommandInteraction } from "discord.js";
import { Command, CommandHandler } from ".";
import { updateResponse } from "../adapters/discord-adapter";
import { getPlayer } from "../adapters/coc-api-adapter";
import { getPlayerStats } from "../adapters/clashking-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const handleClanAdd: CommandHandler = async (
  interaction: CommandInteraction
) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  const clan = interaction.options.getString("clan", true);
  const user = interaction.options.getUser("user", true);
  const playerTag = interaction.options.getString("player-tag", true);
  const recruiter = interaction.user;

  try {
    const player = await getPlayer(playerTag);
    const playerStats = await getPlayerStats(playerTag);

    if (!player || !playerStats) {
      await updateResponse(interaction, {
        content: `Could not find player with tag ${playerTag}.`,
      });
      return;
    }

    const item = {
      pk: `clan#${clan}`,
      sk: `player#${playerTag}`,
      playerName: player.name,
      discordId: user.id,
      trophies: playerStats.trophies,
      addedAt: new Date().toISOString(),
      addedBy: recruiter.id,
    };

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: item,
      })
    );

    await updateResponse(interaction, {
      content: `Successfully added ${player.name} (${playerTag}) to ${clan}.`,
    });
  } catch (error) {
    console.error("Error adding clan member:", error);
    await updateResponse(interaction, {
      content: "An error occurred while adding the clan member.",
    });
  }
};

export const clanAdd: Command = {
  name: "clan-add",
  description: "Adds a new recruit to a clan roster.",
  handler: handleClanAdd,
};