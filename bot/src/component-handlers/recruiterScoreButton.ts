import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  SCORE_PAGE_SIZE,
  RecruiterScoreDisplayContext,
  buildRecruiterScorePageEmbed,
  buildRecruiterTotalsEmbed,
  createRecruiterScoreComponents,
} from "../util/recruiterScoreDisplay";
import { compileRecruiterScoreData } from "../command-handlers/recruiterScore";
import { updateResponse } from "../adapters/discord-adapter";

const PAGE_REGEX = /Page\s+(\d+)\s+of\s+(\d+)/i;

type ScoreButtonAction = "first" | "prev" | "next" | "last";

export const handleRecruiterScorePagination = async (
  interaction: APIMessageComponentInteraction,
  customId: string
) => {
  try {
    const guildId = interaction.guild_id!;
    const config = getConfig(guildId);

    const parts = customId.split("_");
    const action = (parts[2] as ScoreButtonAction) ?? "next";
    const sessionId = parts[3] ?? "global";

    const footer = interaction.message.embeds?.[0]?.footer?.text ?? "";
    const match = footer.match(PAGE_REGEX);
    const currentPage = match ? Number(match[1]) - 1 : 0;
    const totalPagesFromMessage = match ? Number(match[2]) : 1;

    let targetPage = currentPage;
    switch (action) {
      case "first":
        targetPage = 0;
        break;
      case "prev":
        targetPage = Math.max(0, currentPage - 1);
        break;
      case "next":
        targetPage = Math.min(totalPagesFromMessage - 1, currentPage + 1);
        break;
      case "last":
        targetPage = Math.max(0, totalPagesFromMessage - 1);
        break;
    }

    const dataset = await compileRecruiterScoreData(guildId, config);
    const scorePages = Math.max(
      1,
      Math.ceil(dataset.scores.length / SCORE_PAGE_SIZE)
    );
    const totalPages = scorePages + 1; // reserve final page for totals

    if (targetPage >= totalPages) {
      targetPage = totalPages - 1;
    }

    const context: RecruiterScoreDisplayContext = {
      recruitmentOppChannelId: config.RECRUITMENT_OPP_CHANNEL,
      clanPostsChannelId: config.CLAN_POSTS_CHANNEL,
      generatedAt: new Date().toISOString(),
    };

    const isTotalsPage = targetPage === totalPages - 1;
    const embed = isTotalsPage
      ? buildRecruiterTotalsEmbed(dataset.totals, context, targetPage, totalPages)
      : buildRecruiterScorePageEmbed(
          dataset.scores,
          dataset.totals,
          context,
          targetPage,
          totalPages,
          SCORE_PAGE_SIZE
        );

    const components = createRecruiterScoreComponents(
      sessionId,
      totalPages,
      targetPage
    );

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
      components,
    });
  } catch (error) {
    console.error(
      `[handleRecruiterScorePagination] Failed to update recruiter score message for ${interaction.guild_id}: ${error}`
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue refreshing the recruiter scoreboard. Please try again in a moment.",
      embeds: interaction.message.embeds,
      components: interaction.message.components ?? [],
    });
  }
};
