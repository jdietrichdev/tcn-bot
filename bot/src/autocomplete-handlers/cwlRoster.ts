import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import { s3Client } from "../clients/s3-client";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export const handleCwlRoster = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
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
      new ListObjectsV2Command({
        Bucket: "bot-roster-bucket",
        Prefix: `${interaction.guild_id}/`,
        Delimiter: "/",
      })
    );

    console.log(JSON.stringify(objects));

    const rosters = objects.Contents?.filter(
      (object) => object.Key! !== `${interaction.guild_id}/`
    );
    console.log(rosters);

    options.choices = rosters
      ?.filter((object) => {
        return object.Key!.toLowerCase().includes(focused.value.toLowerCase());
      })
      .map((object) => {
        return {
          name: object.Key!.split("/")[1].replace(".csv", ""),
          value: object.Key!.split("/")[1].replace(".csv", ""),
        };
      });

    console.log(options);
  } else {
    throw new Error("No handler defined for autocomplete interaction");
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
