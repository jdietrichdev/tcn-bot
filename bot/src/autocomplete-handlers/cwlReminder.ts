import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
} from "discord-api-types/v10";
import { s3Client } from "../clients/s3-client";
import { ListObjectsCommand } from "@aws-sdk/client-s3";

export const handleCwlReminder = async (
  interaction: APIApplicationCommandAutocompleteInteraction
): Promise<APICommandAutocompleteInteractionResponseCallbackData> => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (
    interaction.data
      .options as APIApplicationCommandInteractionDataStringOption[]
  ).find(
    (option: APIApplicationCommandInteractionDataStringOption) => option.focused
  );

  if (focused && focused.name === "roster") {
    const objects = await s3Client.send(
      new ListObjectsCommand({
        Bucket: "bot-roster-bucket",
        Prefix: `${interaction.guild_id}/`,
      })
    );

    console.log(JSON.stringify(objects));

    options.choices = objects.Contents?.map((object) => {
      return {
        name: object.Key!.replace(".csv", ""),
        value: object.Key!.replace(".csv", ""),
      };
    });
  }

  return options;
};
