import { CommandHandler } from "command-handlers";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
} from "discord-api-types/v10";

export const handleClanAdd = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  // Helper to find the value of a subcommand option
  const getOptionValue = (
    name: string
  ): string | number | undefined => {
    const options = interaction.data.options?.[0]?.options; // Options are nested under the subcommand
    if (!options) return undefined;
    const option = options.find((o) => o.name === name);
    if (
      option?.type === ApplicationCommandOptionType.String ||
      option?.type === ApplicationCommandOptionType.Integer ||
      option?.type === ApplicationCommandOptionType.User
    ) {
      return option.value;
    }
  };

  const clanName = getOptionValue("clan") as string;
  const playerId = getOptionValue("player") as string;
  const playerName = getOptionValue("player-name") as string;
  const trophies = getOptionValue("trophies") as number;

  if (!clanName || !playerId || !playerName || trophies === undefined) {
    throw new Error("Missing required options for clan add.");
  }

  try {
    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: {
          pk: `clan#${clanName}`,
          sk: `player#${playerId}`,
          discordId: playerId,
          playerName: playerName,
          trophies: trophies,
        },
      })
    );

    await updateResponse(
      interaction.application_id,
      interaction.token,
      {
        content: `Successfully added ${playerName} to clan ${clanName}.`,
      }
    );
  } catch (error) {
    console.error("Error adding player to clan:", error);
    await updateResponse(
      interaction.application_id,
      interaction.token,
      {
        content: "An error occurred while adding the player to the clan.",
      }
    );
  }
};