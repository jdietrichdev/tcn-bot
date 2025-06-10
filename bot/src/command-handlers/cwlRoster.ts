import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
// import { getConfig } from "../util/serverConfig";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getCommandOptionData } from "../util/interaction-util";

export const handleCwlRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    // const config = getConfig(interaction.guild_id!);
    const rosterName =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "roster"
      ).value;
    const notificationType =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "type"
      ).value;

    const rosterData = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: {
          pk: interaction.guild_id!,
          sk: `roster#${rosterName}`,
        },
      })
    );
    console.log(JSON.stringify(rosterData));

    if (notificationType === "Announcement") {
      console.log("Sending roster announcement");
    } else if (notificationType === "Reminder") {
      console.log("Sending roster reminder");
    }
  } catch (err) {
    console.error(`Failed to send roster message: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure sending the CWL reminders, please try again",
    });
  }
};
