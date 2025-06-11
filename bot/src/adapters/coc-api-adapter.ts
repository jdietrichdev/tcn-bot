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
