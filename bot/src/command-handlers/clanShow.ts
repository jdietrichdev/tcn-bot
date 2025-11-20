import { CommandInteraction } from "discord.js";
import { Command, CommandHandler } from ".";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handleClanShow: CommandHandler = async (
  interaction: CommandInteraction
) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  const clan = interaction.options.getString("clan", true);

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `clan#${clan}`,
          ":sk": "player#",
        },
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      await updateResponse(interaction, {
        content: `No players found in clan ${clan}`,
      });
      return;
    }

    const playerList = queryResult.Items.map((item) => {
      return `- ${item.playerName} (<@${item.discordId}>) - ${item.trophies} trophies`;
    }).join("\n");

    await updateResponse(interaction, {
      content: `**Players in ${clan}:**\n${playerList}`,
    });
  } catch (error) {
    console.error("Error showing clan roster:", error);
    await updateResponse(interaction, {
      content: "An error occurred while retrieving the clan roster.",
    });
  }
};

export const clanShow: Command = {
  name: "clan-show",
  description: "Shows the roster for a clan.",
  handler: handleClanShow,
};
