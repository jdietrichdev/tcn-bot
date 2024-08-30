import axios from "axios";

const BASE_URL = "https://cocproxy.royaleapi.dev/v1";

export const verify = async (playerTag: string, apiToken: string) => {
  const url = `${BASE_URL}/players/${playerTag.replace(
    "#",
    "%23"
  )}/verifytoken`;
  const response = await axios.post(url, JSON.stringify({ token: apiToken }), {
    headers: {
      Authorization: `Bearer ${process.env.CLASH_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  console.log(response.status);
  console.log(response.data);
  return response.data;
};
