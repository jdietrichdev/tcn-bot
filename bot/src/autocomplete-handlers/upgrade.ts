import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
} from "discord-api-types/v10";
import { TROOPS } from "../constants/upgrades/troops";

export const handleUpgrade = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };
  const focused = (
    interaction.data
      .options as APIApplicationCommandInteractionDataStringOption[]
  ).find((option: APIApplicationCommandInteractionDataStringOption) => {
    return option.focused;
  });

  if (focused && focused.name === "troop") {
    options.choices = Object.keys(TROOPS).map((troop) => ({
      name: troop,
      value: troop,
    }));
  } else {
    throw new Error("No handler defined for autocomplete interaction");
  }

  return {
    data: options,
  };
};
