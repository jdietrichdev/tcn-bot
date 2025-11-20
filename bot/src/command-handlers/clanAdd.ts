import { ChatInputCommandInteraction } from "discord.js";
import { Command } from "command-handlers";
import { updateResponse } from "adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const handleClanAdd = async (
  interaction: ChatInputCommandInteraction
) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  const clanName = interaction.options.getString("clan", true);
  const player = interaction.options.getUser("player", true);
  const playerName = interaction.options.getString("player-name", true);
  const trophies = interaction.options.getInteger("trophies", true);

  try {

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: {
          pk: `clan#${clanName}`,
          sk: `player#${player.id}`,
          discordId: player.id,
          playerName: playerName,
          trophies: trophies,
        },
      })
    );

    await updateResponse(
      interaction.applicationId,
      interaction.token,
      {
        content: `Successfully added ${playerName} to clan ${clanName}.`,
      }
    );
  } catch (error) {
    console.error("Error adding player to clan:", error);
    await updateResponse(
      interaction.applicationId,
      interaction.token,
      {
        content: "An error occurred while adding the player to the clan.",
      }
    );
  }
};

export const clanAdd: Command = {
  name: "clan-add",
  description: "Adds a player to a clan's roster.",
  handler: handleClanAdd,
};