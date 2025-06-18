import axios from "axios";

const BASE_URL = "https://cocproxy.royaleapi.dev/v1";

export const verify = async (playerTag: string, apiToken: string) => {
  try {
    const url = `${BASE_URL}/players/${playerTag.replace(
      "#",
      "%23"
    )}/verifytoken`;
    const response = await axios.post(
      url,
      JSON.stringify({ token: apiToken }),
      {
        headers: {
          Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error("Failed to verify account with Clash API", err);
    throw err;
  }
};

export const getPlayer = async (playerTag: string) => {
  try {
    const url = `${BASE_URL}/players/${playerTag.replace("#", "%23")}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`,
      }
    });
    return response.data;
  } catch (err) {
    console.error("Failed to retrieve player data", err);
    throw err;
  }
}

export const getClan = async (clanTag: string) => {
  try {
    const url = `${BASE_URL}/clans/${clanTag.replace("#", "%23")}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`,
      },
    });
    return response.data;
  } catch (err) {
    console.error("Failed to retrieve clan data", err);
    throw err;
  }
};

export const getCwl = async (clanTag: string) => {
  const url = `${BASE_URL}/clans/${clanTag.replace('#', '%23')}/currentwar/leaguegroup`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`
      }
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response!.status === 404) {
      console.log('Clan not in CWL');
      return {
        tag: clanTag,
        state: 'not_spun'
      };
    } else {
      console.error("Failed to retrieve CWL data for clan");
      throw err;
    }
  }
}
