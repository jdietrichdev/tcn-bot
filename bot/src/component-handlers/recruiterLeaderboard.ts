import {
  APIMessageComponentInteraction,
  InteractionResponseType,
} from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  buildRecruiterLeaderboardEmbed,
  compileRecruiterScoreData,
} from "../command-handlers/recruiterScore";
import { getRecruiterLeaderboardComponents } from "../util/recruiterScoreDisplay";

export const handleRecruiterLeaderboardRefresh = async (
  interaction: APIMessageComponentInteraction
) => {
  const guildId = interaction.guild_id!;
  const config = getConfig(guildId);
  const dataset = await compileRecruiterScoreData(guildId, config);
  const embed = buildRecruiterLeaderboardEmbed(dataset.scores);

  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      embeds: [embed],
      components: getRecruiterLeaderboardComponents(),
    },
  };
};
