import axios from "axios";
import { getClan } from "./coc-api-adapter";

const CLASHKING_BASE_URL = "https://api.clashk.ing";

interface WarHit {
  war_data: {
    type: string;
    endTime: string;
    clan: {
      tag: string;
      name: string;
    };
  };
  member_data: {
    tag: string;
    name: string;
  };
  attacks: Array<{
    stars: number;
    destructionPercentage: number;
    fresh: boolean;
  }>;
}

interface WarHitsResponse {
  items: WarHit[];
}

const CWL_LEAGUE_NAMES: Record<number, string> = {
  48000000: "Unranked",
  48000001: "Bronze League III",
  48000002: "Bronze League II",
  48000003: "Bronze League I",
  48000004: "Silver League III",
  48000005: "Silver League II",
  48000006: "Silver League I",
  48000007: "Gold League III",
  48000008: "Gold League II",
  48000009: "Gold League I",
  48000010: "Crystal League III",
  48000011: "Crystal League II",
  48000012: "Crystal League I",
  48000013: "Master League III",
  48000014: "Master League II",
  48000015: "Master League I",
  48000016: "Champion League III",
  48000017: "Champion League II",
  48000018: "Champion League I",
};

export const getPlayerCWLLeague = async (
  playerTag: string
): Promise<string> => {
  try {
    const tag = encodeURIComponent(playerTag);
    const warHitsUrl = `${CLASHKING_BASE_URL}/player/${tag}/warhits`;

    console.log(`Fetching war hits for ${playerTag} from ${warHitsUrl}`);

    let warHitsResponse;
    try {
      warHitsResponse = await axios.get<WarHitsResponse>(warHitsUrl, {
        timeout: 10000,
      });
    } catch (apiError) {
      console.error(
        `ClashKing API request failed for ${playerTag}:`,
        apiError instanceof Error ? apiError.message : apiError
      );
      return "Unknown";
    }

    console.log(
      `Successfully fetched ${warHitsResponse.data.items?.length || 0} war hits`
    );

    const warHits = warHitsResponse.data.items;

    if (!warHits || warHits.length === 0) {
      console.log(`No war hits found for ${playerTag}`);
      return "Unknown";
    }

    const cwlStartDate = new Date("2025-10-01T00:00:00Z");
    const cwlEndDate = new Date("2025-10-10T23:59:59Z");

    console.log(`Total war hits: ${warHits.length}, checking for CWL between ${cwlStartDate.toISOString()} and ${cwlEndDate.toISOString()}`);
    
    if (warHits.length > 0) {
      console.log(`Sample war hit:`, JSON.stringify(warHits[0]));
    }

    const cwlAttacks = warHits.filter((hit) => {
      const warDate = new Date(hit.war_data.endTime);
      const warType = hit.war_data.type?.toLowerCase();
      return (
        warDate >= cwlStartDate &&
        warDate <= cwlEndDate &&
        warType === "cwl"
      );
    });

    console.log(`Found ${cwlAttacks.length} CWL attacks for ${playerTag} between Oct 1-10`);
    
    if (cwlAttacks.length === 0) {
      console.log(
        `No CWL attacks found for ${playerTag} between Oct 1-10, 2025`
      );
      return "Unknown";
    }

    const clanAttackCounts = new Map<string, { count: number; name: string }>();
    cwlAttacks.forEach((hit) => {
      const tag = hit.war_data.clan.tag;
      const existing = clanAttackCounts.get(tag);
      if (existing) {
        existing.count++;
      } else {
        clanAttackCounts.set(tag, { count: 1, name: hit.war_data.clan.name });
      }
    });

    let mostAttacksClan = { tag: "", count: 0, name: "" };
    clanAttackCounts.forEach((value, tag) => {
      if (value.count > mostAttacksClan.count) {
        mostAttacksClan = { tag, count: value.count, name: value.name };
      }
    });

    const clanTag = mostAttacksClan.tag;
    console.log(
      `Player ${playerTag} attacked ${mostAttacksClan.count} times in CWL for clan ${clanTag} (${mostAttacksClan.name})`
    );
    
    if (clanAttackCounts.size > 1) {
      console.log(`Note: Player participated in CWL for ${clanAttackCounts.size} different clans`);
    }

    console.log(`Attempting to fetch clan data for ${clanTag}`);

    try {
      const clanData = await getClan(clanTag);
      console.log(`Clan data for ${clanTag}:`, JSON.stringify({
        name: clanData?.name,
        warLeague: clanData?.warLeague
      }));

      if (clanData && clanData.warLeague && clanData.warLeague.id) {
        const leagueName = CWL_LEAGUE_NAMES[clanData.warLeague.id];
        console.log(
          `Clan ${clanTag} war league: ${leagueName} (ID: ${clanData.warLeague.id})`
        );
        return leagueName || "Unknown";
      }

      console.log(`Could not get war league for clan ${clanTag}`);
      return "Unknown";
    } catch (clanError) {
      console.error(`Error fetching clan ${clanTag}:`, clanError);
      if (axios.isAxiosError(clanError)) {
        console.error(`Response status:`, clanError.response?.status);
        console.error(`Response data:`, clanError.response?.data);
      }
      return "Unknown";
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `ClashKing API error for ${playerTag}:`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`Failed to get CWL league for player ${playerTag}:`, error);
    }
    return "Unknown";
  }
};
