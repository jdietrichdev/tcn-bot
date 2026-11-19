import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";
import { canManageCwlDashboard } from "../component-handlers/cwlSignupDashboard";
import { getCommandOptionData } from "../util/interaction-util";
import { buildCwlDashboardMessage } from "../util/cwlSignup";
import {
  findCwlSignupByName,
  saveCwlSignup,
} from "../util/cwlSignupStore";

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

  const dashboardMessage = buildCwlDashboardMessage(signup);
  if (
    signup.dashboardMessageId &&
    signup.dashboardChannelId === interaction.channel_id
  ) {
    await updateMessage(
      interaction.channel_id,
      signup.dashboardMessageId,
      dashboardMessage
    );
  } else {
    const posted = await sendMessage(
      dashboardMessage,
      interaction.channel_id
    );
    signup.dashboardChannelId = interaction.channel_id;
    signup.dashboardMessageId = posted.id;
    await saveCwlSignup(signup);
  }

  await updateResponse(interaction.application_id, interaction.token, {
    content: `CWL dashboard for **${signupName}** is available in <#${interaction.channel_id}>.`,
  });
};
