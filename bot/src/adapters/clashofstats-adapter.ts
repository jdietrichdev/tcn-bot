import axios from "axios";

const BASE_URL = "https://api.clashofstats.com";


export const getPlayerCWLLeague = async (playerTag: string): Promise<string> => {
  try {
    const formattedTag = playerTag.replace("#", "");
    const url = `${BASE_URL}/players/${formattedTag}/warsleagues`;
    
    console.log(`Fetching CWL data for ${playerTag} from ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        
        "Accept": "application/json",
      },
      timeout: 5000, 
    });

    console.log(`CWL response for ${playerTag}:`, JSON.stringify(response.data).substring(0, 500));
   
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const mostRecent = response.data[0];
      console.log(`Most recent CWL data:`, JSON.stringify(mostRecent));
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
      console.error(`Clash of Stats API error for ${playerTag}:`, err.response?.status, err.response?.data);
    } else {
      console.error(`Failed to get CWL league for ${playerTag}:`, err);
    }
    return "Unknown";
  }
};


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
