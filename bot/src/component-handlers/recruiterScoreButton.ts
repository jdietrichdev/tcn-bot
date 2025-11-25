import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  SCORE_PAGE_SIZE,
  RecruiterScoreDisplayContext,
  buildRecruiterScorePageEmbed,
  buildRecruiterTotalsEmbed,
  createRecruiterScoreComponents,
} from "../util/recruiterScoreDisplay";
const recruiterScoreCache: Record<string, { dataset: any; timestamp: number }> = {};
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
    if (customId === "recruiter_score_refresh") {
      delete recruiterScoreCache[guildId];
      const dataset = await compileRecruiterScoreData(guildId, config);
      recruiterScoreCache[guildId] = { dataset, timestamp: Date.now() };
      const scorePages = Math.max(1, Math.ceil(dataset.scores.length / SCORE_PAGE_SIZE));
      const totalPages = scorePages + 1;
      const context: RecruiterScoreDisplayContext = {
        recruitmentOppChannelId: config.RECRUITMENT_OPP_CHANNEL,
        clanPostsChannelId: config.CLAN_POSTS_CHANNEL,
        generatedAt: new Date().toISOString(),
      };
      const embed = buildRecruiterScorePageEmbed(
        dataset.scores,
        dataset.totals,
        context,
        0,
        totalPages,
        SCORE_PAGE_SIZE
      );
      const components = createRecruiterScoreComponents("global", totalPages, 0);
      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [embed],
        components,
      });
      return;
    }
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
    let dataset;
    const cacheEntry = recruiterScoreCache[guildId];
    // Cache duration: 1 hour
    if (cacheEntry && Date.now() - cacheEntry.timestamp < 60 * 60 * 1000) {
      dataset = cacheEntry.dataset;
    } else {
      dataset = await compileRecruiterScoreData(guildId, config);
      recruiterScoreCache[guildId] = { dataset, timestamp: Date.now() };
    }
    const scorePages = Math.max(1, Math.ceil(dataset.scores.length / SCORE_PAGE_SIZE));
    const totalPages = scorePages + 1;
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
      `[handleRecruiterScorePagination] Failed to update recruiter score message for ${interaction.guild_id}:`, error
    );
    let errorMsg = "There was an issue refreshing the recruiter scoreboard. Please try again in a moment.";
    const errObj = typeof error === "object" && error !== null ? error as any : {};
    if (errObj.statusCode === 429) {
      errorMsg = "Discord is rate limiting the bot. Please wait a few seconds and try again.";
    } else if (errObj.statusCode === 404 && errObj.reason === "Unknown Message") {
      errorMsg = "The scoreboard message could not be found or was deleted. Please rerun the command.";
    }
    await updateResponse(interaction.application_id, interaction.token, {
      content: errorMsg,
      embeds: interaction.message.embeds,
      components: interaction.message.components ?? [],
    });
  }
};
