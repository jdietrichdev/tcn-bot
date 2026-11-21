import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { canManageCwlDashboard } from "../component-handlers/cwlSignupDashboard";
import { getCommandOptionData } from "../util/interaction-util";
import { buildCwlDashboardMessage } from "../util/cwlSignup";
import { findCwlSignupByName } from "../util/cwlSignupStore";

export const handleCwlDashboard = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  if (!interaction.guild_id || !interaction.channel_id) {
    throw new Error("The CWL dashboard can only be opened in a server channel.");
  }
  if (!canManageCwlDashboard(interaction.guild_id, interaction.member)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Only server admins can manage CWL signups.",
    });
    return;
  }
  const signupName =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "signup-name"
    ).value;
  const signup = await findCwlSignupByName(
    interaction.guild_id,
    signupName
  );
  if (!signup) {
    throw new Error(`CWL signup "${signupName}" was not found.`);
  }

  await updateResponse(
    interaction.application_id,
    interaction.token,
    buildCwlDashboardMessage(signup)
  );
};
