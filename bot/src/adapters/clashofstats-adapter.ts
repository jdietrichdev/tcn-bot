import axios from "axios";

const BASE_URL = "https://api.clashofstats.com";

/**
 * Get player's CWL league history from Clash of Stats
 * Returns the most recent CWL league the player participated in
 */
export const getPlayerCWLLeague = async (playerTag: string): Promise<string> => {
  try {
    const formattedTag = playerTag.replace("#", "");
    const url = `${BASE_URL}/players/${formattedTag}/warsleagues`;
    
    const response = await axios.get(url, {
      headers: {
        // Clash of Stats is a free API but has rate limits
        // No API key needed for basic usage
        "Accept": "application/json",
      },
      timeout: 5000, // 5 second timeout
    });

    // The API returns an array of CWL participations
    // We want the most recent one
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const mostRecent = response.data[0];
      // CWL league is typically in format like "Crystal League I"
      if (mostRecent.league) {
        return mostRecent.league;
      }
    }

    return "No CWL History";
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        console.log(`Player ${playerTag} not found in Clash of Stats`);
        return "Not Found";
      }
      if (err.response?.status === 429) {
        console.log("Rate limited by Clash of Stats API");
        return "Rate Limited";
      }
      console.error(`Clash of Stats API error for ${playerTag}:`, err.response?.status);
    } else {
      console.error(`Failed to get CWL league for ${playerTag}:`, err);
    }
    return "Unknown";
  }
};

/**
 * Alternative: Get player stats which may include CWL info
 */
export const getPlayerStats = async (playerTag: string) => {
  try {
    const formattedTag = playerTag.replace("#", "");
    const url = `${BASE_URL}/players/${formattedTag}`;
    
    const response = await axios.get(url, {
      headers: {
        "Accept": "application/json",
      },
      timeout: 5000,
    });

    return response.data;
  } catch (err) {
    console.error(`Failed to get player stats from Clash of Stats:`, err);
    throw err;
  }
};
