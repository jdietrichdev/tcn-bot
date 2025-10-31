import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import { fetchCWLResponses } from "../util/fetchCWLResponses";

export const handleCwlResponse = async (
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

  if (focused && focused.name === "user") {
    const query = (focused.value || "").toLowerCase();

    try {
      const responses = await fetchCWLResponses();
      
              const usernames = [...new Set(responses.map(r => r.username))].sort();

      const exactMatch = usernames.filter(u => u.toLowerCase() === query);
      const startsWith = usernames.filter(u => u.toLowerCase().startsWith(query) && !exactMatch.includes(u));
      const contains = usernames.filter(u => u.toLowerCase().includes(query) && !startsWith.includes(u) && !exactMatch.includes(u));

      const sorted = [...exactMatch, ...startsWith, ...contains];

      options.choices = sorted.slice(0, 25).map((username) => ({
        name: username,
        value: username,
      }));
    } catch (error) {
      console.error("Error fetching CWL responses for autocomplete:", error);
      options.choices = [];
    }
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
