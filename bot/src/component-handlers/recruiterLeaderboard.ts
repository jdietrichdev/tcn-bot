import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  buildRecruiterLeaderboardEmbed,
  compileRecruiterScoreData,
} from "../command-handlers/recruiterScore";
import { getRecruiterLeaderboardComponents } from "../util/recruiterScoreDisplay";
import { updateResponse } from "../adapters/discord-adapter";

export const handleRecruiterLeaderboardRefresh = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const guildId = interaction.guild_id!;
    const config = getConfig(guildId);

    if (!config) {
      console.error(`[handleRecruiterLeaderboardRefresh] No config found for guild ${guildId}`);
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Could not find server configuration. Please contact an admin.",
        embeds: [],
        components: [],
      });
      return;
    }

    const dataset = await compileRecruiterScoreData(guildId, config);
    const embed = buildRecruiterLeaderboardEmbed(dataset.scores);

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components: getRecruiterLeaderboardComponents(),
    });
  } catch (error) {
    console.error(
      `[handleRecruiterLeaderboardRefresh] Failed to refresh recruiter leaderboard for ${interaction.guild_id}: ${error}`
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue refreshing the recruiter leaderboard. Please try again in a moment.",
      embeds: interaction.message.embeds,
      components: interaction.message.components ?? [],
    });
  }
};
