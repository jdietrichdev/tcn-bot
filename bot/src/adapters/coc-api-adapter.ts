import axios from "axios";

const BASE_URL = "https://cocproxy.royaleapi.dev/v1";

export const verify = async (playerTag: string, apiToken: string) => {
  try {
    const url = `${BASE_URL}/players/${playerTag.replace(
      "#",
      "%23"
    )}/verifytoken`;
    await axios.post(
      url,
      { token: apiToken },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Failed to verify account with Clash API", err);
    throw err;
  }
};
