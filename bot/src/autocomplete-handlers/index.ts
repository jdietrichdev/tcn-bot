import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import * as autocomplete from "./handlers";

export const handleAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  try {
    switch (interaction.data!.name) {
      case "upgrade":
        return await autocomplete.handleUpgrade(interaction);
        break;
      default:
        console.log("Autocomplete not found, no response needed");
        throw new Error("No autocomplete process defined");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};
