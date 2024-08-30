import axios from "axios";

const BASE_URL = "https://cocproxy.royaleapi.dev/v1";

export const verify = async (playerTag: string, apiToken: string) => {
  const url = encodeURI(`${BASE_URL}/players/${playerTag}/verify`);
  const response = await axios.post(url, JSON.stringify({ token: apiToken }), {
    headers: { Authorization: `Bearer ${process.env.CLASH_API_TOKEN}` },
  });
  console.log(response.status);
  console.log(response.data);
  return response.data;
};
