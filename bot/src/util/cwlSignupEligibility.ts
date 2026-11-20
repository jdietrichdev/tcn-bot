import type { PlayerCwlHistoryStats } from "../adapters/clashking-adapter";

const LEAGUE_RANKS: Record<string, number> = {
  Unranked: 0,
  "Bronze League III": 1,
  "Bronze League II": 2,
  "Bronze League I": 3,
  "Silver League III": 4,
  "Silver League II": 5,
  "Silver League I": 6,
  "Gold League III": 7,
  "Gold League II": 8,
  "Gold League I": 9,
  "Crystal League III": 10,
  "Crystal League II": 11,
  "Crystal League I": 12,
  "Master League III": 13,
  "Master League II": 14,
  "Master League I": 15,
  "Champion League III": 16,
  "Champion League II": 17,
  "Champion League I": 18,
  "Titan III CWL": 19,
  "Titan II CWL": 20,
  "Titan I CWL": 21,
  "Legends CWL": 22,
};

const normalizeLeagueName = (league: string) =>
  league.trim().toLowerCase().replace(/\s+/g, " ");

export const getCwlLeagueRank = (league: string): number | undefined => {
  const normalized = normalizeLeagueName(league);
  const exactLeague = Object.entries(LEAGUE_RANKS).find(
    ([name]) => normalizeLeagueName(name) === normalized
  );
  if (exactLeague) {
    return exactLeague[1];
  }
  if (normalized.includes("titan")) {
    const titanTier = normalized.match(/\btitan\s+(iii|ii|i)\b/);
    if (titanTier?.[1] === "i") return 21;
    if (titanTier?.[1] === "ii") return 20;
    if (titanTier?.[1] === "iii") return 19;
    return 19;
  }
  if (normalized.includes("legend")) {
    return 22;
  }
  if (normalized === "champion" || normalized === "champion cwl") {
    return 16;
  }
  return undefined;
};

export const getCwlTryoutCategoryKey = (
  league: string
): "titan" | "champion" | "legends" | "default" => {
  const normalized = normalizeLeagueName(league);
  if (normalized.includes("titan")) return "titan";
  if (normalized.includes("champion")) return "champion";
  if (normalized.includes("legend")) return "legends";
  return "default";
};

export interface CwlSignupReview {
  requiresTicket: boolean;
  reason?: string;
}

export const getCwlSignupReview = (
  targetLeague: string,
  previousStats: PlayerCwlHistoryStats | undefined
): CwlSignupReview => {
  const targetRank = getCwlLeagueRank(targetLeague);
  if (targetRank !== undefined && targetRank <= 15) {
    return { requiresTicket: false };
  }
  if (targetRank === undefined) {
    return {
      requiresTicket: true,
      reason: `The target league "${targetLeague}" could not be matched to a CWL tier.`,
    };
  }
  if (
    !previousStats ||
    previousStats.averageStars === undefined ||
    !previousStats.league
  ) {
    return {
      requiresTicket: true,
      reason: "There is not enough previous CWL history to verify eligibility.",
    };
  }

  const previousRank = getCwlLeagueRank(previousStats.league);
  if (previousRank === undefined) {
    return {
      requiresTicket: true,
      reason: `The previous league "${previousStats.league}" could not be matched to a CWL tier.`,
    };
  }

  const averageStars = previousStats.averageStars;
  const isSameOrHigherLeague = targetRank >= previousRank;
  if (averageStars <= 2.2 && isSameOrHigherLeague) {
    return {
      requiresTicket: true,
      reason: `Your previous CWL average was ${averageStars.toFixed(2)} stars. A ticket is required to sign up for the same or a higher league at 2.2 stars or below.`,
    };
  }
  if (averageStars < 2.8 && targetRank > previousRank) {
    return {
      requiresTicket: true,
      reason: `Your previous CWL average was ${averageStars.toFixed(2)} stars. A ticket is required before moving up with an average below 2.8 stars.`,
    };
  }

  const isTitanTarget = getCwlTryoutCategoryKey(targetLeague) === "titan";
  const wasInTitanLeague =
    getCwlTryoutCategoryKey(previousStats.league) === "titan";
  if (isTitanTarget && !wasInTitanLeague && averageStars >= 2.8) {
    return {
      requiresTicket: true,
      reason:
        "A ticket is required for a first-time Titan CWL signup, even when the 2.8-star promotion requirement is met.",
    };
  }

  return { requiresTicket: false };
};
