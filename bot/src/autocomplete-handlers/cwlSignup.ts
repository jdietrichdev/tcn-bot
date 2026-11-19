import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import {
  CWL_KNOWN_CLANS,
} from "../util/cwlSignup";
import {
  findCwlSignupByName,
  listCwlSignups,
} from "../util/cwlSignupStore";

export const handleCwlSignupAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };
  const commandOptions =
    (interaction.data.options as
      | APIApplicationCommandInteractionDataStringOption[]
      | undefined) ?? [];
  const focused = commandOptions.find((option) => option.focused);

  if (!focused || !interaction.guild_id) {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  const query = focused.value.toLowerCase();
  if (focused.name === "signup-name" || focused.name === "name") {
    const signups = await listCwlSignups(interaction.guild_id);
    options.choices = signups
      .filter((signup) => signup.signupName.toLowerCase().includes(query))
      .slice(0, 25)
      .map((signup) => ({
        name: signup.signupName,
        value: signup.signupName,
      }));
  } else if (focused.name === "clan-tag") {
    const signupName = commandOptions.find(
      (option) => option.name === "signup-name"
    )?.value;
    const signup = signupName
      ? await findCwlSignupByName(interaction.guild_id, signupName)
      : undefined;
    const existingTags = new Set(
      signup?.clans.map((clan) => clan.tag.toUpperCase()) ?? []
    );
    options.choices = CWL_KNOWN_CLANS.filter(
      (clan) =>
        !existingTags.has(clan.tag) &&
        `${clan.name} ${clan.tag} #${clan.tag}`.toLowerCase().includes(query)
    )
      .slice(0, 25)
      .map((clan) => ({
        name: `${clan.name} (#${clan.tag})`,
        value: clan.tag,
      }));
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
