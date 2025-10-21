import axios from "axios";
import {
  getClan,
  getCwl,
  getPlayer,
  verify,
} from "../../src/adapters/coc-api-adapter";

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

test("getPlayer should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: {} });
  await getPlayer("tag");
  expect(axios.get).toHaveBeenCalledWith(`${BASE_URL}/players/tag`, {
    headers: {
      Authorization: "Bearer API_TOKEN",
    },
  });
});

test("getPlayer should return player data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { playertag: "tag" } });
  const response = await getPlayer("tag");
  expect(response).toEqual({ playertag: "tag" });
});

test("getPlayer should throw error when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(new Error("Failed"));
  await expect(getPlayer("tag")).rejects.toThrow("Failed");
});

test("getClan should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: {} });
  await getClan("tag");
  expect(axios.get).toHaveBeenCalledWith(`${BASE_URL}/clans/tag`, {
    headers: {
      Authorization: "Bearer API_TOKEN",
    },
  });
});

test("getClan should return clan data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { clantag: "tag" } });
  const response = await getClan("tag");
  expect(response).toEqual({ clantag: "tag" });
});

test("getClan should throw error when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(new Error("Failed"));
  await expect(getClan("tag")).rejects.toThrow("Failed");
});

test("getCwl should call get with correct parameters", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: {} });
  await getCwl("tag");
  expect(axios.get).toHaveBeenCalledWith(`${BASE_URL}/players/tag`, {
    headers: {
      Authorization: "Bearer API_TOKEN",
    },
  });
});

test("getCwl should return player data", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { clantag: "tag" } });
  const response = await getCwl("tag");
  expect(response).toEqual({ clantag: "tag" });
});

test("getCwl should throw error when request fails", async () => {
  jest.mocked(axios.get).mockRejectedValue(new Error("Failed"));
  await expect(getCwl("tag")).rejects.toThrow("Failed");
});
