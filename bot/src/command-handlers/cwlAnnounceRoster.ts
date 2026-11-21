import {
  APIApplicationCommandInteractionDataChannelOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { buildCwlRosterEmbed } from "../util/cwlSignup";
import { findCwlSignupByName } from "../util/cwlSignupStore";
import { loadTownHallEmojiMap } from "../util/townHallEmoji";

export const handleCwlAnnounceRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const guildId = interaction.guild_id;
  if (!guildId) {
    throw new Error("CWL rosters can only be announced from a server.");
  }
  const signupName =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "signup-name"
    ).value;
  const channelId =
    getCommandOptionData<APIApplicationCommandInteractionDataChannelOption>(
      interaction,
      "channel"
    ).value;
  const signup = await findCwlSignupByName(guildId, signupName);
  if (!signup || signup.clans.length === 0) {
    throw new Error(`No clans are configured for "${signupName}".`);
  }

  const townHallEmojiIds = loadTownHallEmojiMap();
  for (const clan of signup.clans) {
    await sendMessage(
      {
        embeds: [
          buildCwlRosterEmbed(
            signup.signupName,
            clan,
            townHallEmojiIds
          ),
        ],
      },
      channelId
    );
  }

  await updateResponse(interaction.application_id, interaction.token, {
    content: `Final CWL rosters for **${signup.signupName}** were posted in <#${channelId}>.`,
  });
};
