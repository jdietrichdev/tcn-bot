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
  const getOptionValue = (
    name: string,
  ): string | number | undefined => {
    const subcommand = interaction.data.options?.[0];

    if (subcommand?.type !== ApplicationCommandOptionType.Subcommand) {
      return undefined;
    }

    const option = subcommand.options?.find(
      (o) => o.name === name
    );

    return (option?.type === ApplicationCommandOptionType.String || option?.type === ApplicationCommandOptionType.Integer || option?.type === ApplicationCommandOptionType.User)
      ? option.value
      : undefined;
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