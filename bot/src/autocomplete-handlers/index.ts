import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import * as autocomplete from "./handlers";

export const handleAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  try {
    switch (interaction.data.name) {
      case "upgrade":
        return await autocomplete.handleUpgrade(interaction);
      case "cwl-roster":
        return await autocomplete.handleCwlRoster(interaction);
      case "link":
        return await autocomplete.handleLink(interaction);
      case "nomination-result":
        return await autocomplete.handleNominationResult(interaction);
      case "question-close":
        return await autocomplete.handleQuestionClose(interaction);
      case "question-answer":
        return await autocomplete.handleQuestionAnswer(interaction);
      default:
        console.log("Autocomplete not found, no response needed");
        throw new Error("No autocomplete process defined");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};
