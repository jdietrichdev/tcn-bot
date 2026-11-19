import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { buildCwlRosterMessage } from "../util/cwlSignup";
import {
  findCwlSignupByName,
  saveCwlSignup,
} from "../util/cwlSignupStore";

export const handleInitiateCwlSignup = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const signupName =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "name"
    ).value;
  const channelId = interaction.channel_id;
  if (!interaction.guild_id || !channelId) {
    throw new Error("CWL signups must be started in a server text channel.");
  }

  const signup = await findCwlSignupByName(interaction.guild_id, signupName);
  if (!signup || signup.clans.length === 0) {
    throw new Error(
      `No clans are configured for "${signupName}". Add clans with /cwl-add-clan first.`
    );
  }
  if (signup["message"]) {
    throw new Error(
      `CWL signup "${signupName}" uses the previous single-message format. Create a new signup name for per-clan rosters.`
    );
  }

  signup.channelId = signup.channelId ?? channelId;
  signup.status = "open";
  await saveCwlSignup(signup);

  let createdCount = 0;
  for (const clan of signup.clans) {
    clan.accounts = Array.isArray(clan.accounts) ? clan.accounts : [];
    const message = buildCwlRosterMessage(signup, clan);

    if (clan.messageId) {
      await updateMessage(signup.channelId, clan.messageId, message);
      continue;
    }

    const postedMessage = await sendMessage(message, signup.channelId);
    clan.messageId = postedMessage.id;
    createdCount += 1;
    await saveCwlSignup(signup);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  await updateResponse(interaction.application_id, interaction.token, {
    content: `CWL roster signups are posted in <#${signup.channelId}>. Created ${createdCount} new roster${createdCount === 1 ? "" : "s"}.`,
  });
};
