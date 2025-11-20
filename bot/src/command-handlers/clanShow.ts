import {
  CommandInteraction,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command, CommandHandler } from "command-handlers";
import { updateResponse } from "adapters/discord-adapter";
import { APIEmbed } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

interface PlayerItem {
  pk: string;
  sk: string;
  playerName: string;
  discordId: string;
  trophies: number;
}

export const handleClanShow = async (
  interaction: ChatInputCommandInteraction
) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  const clanName = interaction.options.getString("clan", true);

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `clan#${clanName}`,
          ":sk": "player#",
        },
      })
    );

    const players = queryResult.Items as PlayerItem[] | undefined;

    if (!players || players.length === 0) {
      await updateResponse(
        interaction.applicationId,
        interaction.token,
        {
          content: `No players found in clan ${clanName}.`,
        }
      );
      return;
    }

    const playerList = players
      .map((player) => {
        return `- ${player.playerName} (<@${player.discordId}>) - ${player.trophies} trophies`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`Players in ${clanName}`)
      .setDescription(playerList)
      .setColor("Blue");

    await updateResponse(interaction.applicationId, interaction.token, {
      embeds: [embed.toJSON() as APIEmbed],
    });
  } catch (error) {
    console.error("Error showing clan roster:", error);
    await updateResponse(
      interaction.applicationId,
      interaction.token,
      {
        content: "An error occurred while retrieving the clan roster.",
      }
    );
  }
};

export const clanShow: Command = {
  name: "clan-show",
  description: "Shows the roster for a clan.",
  handler: handleClanShow,
};
