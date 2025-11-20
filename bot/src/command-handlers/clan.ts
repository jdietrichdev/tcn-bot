import { EmbedBuilder } from "discord.js";
import { CommandHandler } from "command-handlers";
import { updateResponse } from "adapters/discord-adapter";
import {
  APIEmbed,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
} from "discord-api-types/v10";
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
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const getOptionValue = (name: string): string | undefined => {
    const subcommand = interaction.data.options?.[0];

    if (subcommand?.type !== ApplicationCommandOptionType.Subcommand) {
      return undefined;
    }

    const option = subcommand.options?.find(
      (o) => o.name === name
    );

    return option?.type === ApplicationCommandOptionType.String ? option.value : undefined;
  };

  const clanName = getOptionValue("clan");
  if (!clanName) {
    throw new Error("Clan name is a required option for clan show.");
  }
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
        interaction.application_id,
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

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed.toJSON() as APIEmbed],
    });
  } catch (error) {
    console.error("Error showing clan roster:", error);
    await updateResponse(
      interaction.application_id,
      interaction.token,
      {
        content: "An error occurred while retrieving the clan roster.",
      }
    );
  }
};