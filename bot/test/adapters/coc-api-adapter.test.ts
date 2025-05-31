import axios from "axios";
import { verify } from "../../src/adapters/coc-api-adapter";

jest.mock("axios");

process.env.CLASH_API_TOKEN = "API_TOKEN";
const BASE_URL = "https://cocproxy.royaleapi.dev/v1";

test("verify should call post with correct parameters", async () => {
  await verify("#player", "token");
  expect(axios.post).toHaveBeenCalledWith(
    `${BASE_URL}/players/%23player/verifytoken`,
    { token: "token" },
    {
      headers: {
        Authorization: "Bearer API_TOKEN",
        "Content-Type": "application/json",
      },
    }
  );
});

test("verify should throw error when request fails", async () => {
  jest.mocked(axios.post).mockRejectedValue(new Error("Failed"));
  await expect(verify("#player", "token")).rejects.toThrow(new Error("Failed"));
});
