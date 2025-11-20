import { CommandInteraction } from "discord.js";
import { Command, CommandHandler } from ".";
import { updateResponse } from "../adapters/discord-adapter";
import { getPlayer } from "../adapters/coc-api-adapter";
import { getPlayerStats } from "../adapters/clashking-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const handleClanAdd = async (interaction: CommandInteraction) => {
  if (!interaction.isChatInputCommand()) return;

  const clan = interaction.options.getString("clan", true);
  const user = interaction.options.getUser("user", true);
  const playerTag = interaction.options.getString("player-tag", true);
  const recruiter = interaction.user;

  try {
    const player = await getPlayer(playerTag);
    const playerStats = await getPlayerStats(playerTag);

    if (!player || !playerStats) {
      await updateResponse(interaction, {
        content: `Could not find player with tag ${playerTag}`,
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
      content: `Successfully added ${player.name} (${playerTag}) to ${clan}`,
    });
  } catch (error) {
    console.error("Error adding clan member:", error);
    await updateResponse(interaction, {
      content: "An error occurred while adding the clan member.",
    });
  }
};

const handleClanShow = async (interaction: CommandInteraction) => {
  if (!interaction.isChatInputCommand()) return;

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
    }).sort((a, b) => b.trophies - a.trophies).join("\n");

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

export const handleClan: CommandHandler = async (
  interaction: CommandInteraction
) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "add":
      await handleClanAdd(interaction);
      break;
    case "show":
      await handleClanShow(interaction);
      break;
    default:
      await updateResponse(interaction, {
        content: "Unknown subcommand.",
      });
  }
};

export const clan: Command = {
  name: "clan",
  description: "Manage clan rosters.",
  handler: handleClan,
};
