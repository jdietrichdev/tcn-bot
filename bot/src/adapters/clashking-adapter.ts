import axios from "axios";
import { getClan } from "./coc-api-adapter";

const CLASHKING_BASE_URL = "https://api.clashk.ing";

interface JoinLeaveEvent {
  type: "join" | "leave";
  clan: string;
  time: string;
  tag: string;
  name: string;
  th: number;
  clan_name: string;
}

interface JoinLeaveHistory {
  items: JoinLeaveEvent[];
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
    const historyUrl = `${CLASHKING_BASE_URL}/player/${tag}/join-leave`;

    console.log(`Fetching join/leave history for ${playerTag} from ClashKing`);

    const historyResponse = await axios.get<JoinLeaveHistory>(historyUrl, {
      timeout: 5000,
    });

    const history = historyResponse.data.items;

    if (!history || history.length === 0) {
      console.log(`No join/leave history found for ${playerTag}`);
      return "Unknown";
    }

    const targetDate = new Date("2025-10-01T23:59:59Z");

    const sortedHistory = history.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    let clanTag: string | null = null;

    for (const event of sortedHistory) {
      const eventDate = new Date(event.time);

      if (eventDate <= targetDate) {
        if (event.type === "join") {
          clanTag = event.clan;
          console.log(
            `Player ${playerTag} was in clan ${clanTag} (${event.clan_name}) on Oct 1st`
          );
          break;
        }
      }
    }

    if (!clanTag) {
      console.log(`Could not determine clan for ${playerTag} on Oct 1st`);
      return "Unknown";
    }

    const clanData = await getClan(clanTag);

    if (clanData && clanData.warLeague && clanData.warLeague.id) {
      const leagueName = CWL_LEAGUE_NAMES[clanData.warLeague.id];
      console.log(
        `Clan ${clanTag} war league: ${leagueName} (ID: ${clanData.warLeague.id})`
      );
      return leagueName || "Unknown";
    }

    console.log(`Could not get war league for clan ${clanTag}`);
    return "Unknown";
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `ClashKing API error for ${playerTag}:`,
        error.response?.status,
        error.response?.data
      );
    } else {
      console.error(`Failed to get CWL league for player ${playerTag}:`, error);
    }
    return "Unknown";
  }
};
