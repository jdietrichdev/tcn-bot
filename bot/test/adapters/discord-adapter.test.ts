import { updateMessage } from "../../src/adapters/discord-adapter";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_URL = "https://discord.com/api/v10";

test("updateMessage should call patch with correct parameters", async () => {
  await updateMessage("appId", "token", { type: 1 });
  expect(mockedAxios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`,
    JSON.stringify({ type: 1 }),
    { headers: { "Content-Type": "application/json" } }
  );
});

test("updateMessage should throw error when request fails", async () => {
  mockedAxios.patch.mockImplementation(() => {
    throw new Error("Failed");
  });
  await expect(() =>
    updateMessage("appId", "token", { type: 1 })
  ).rejects.toThrow(new Error("Request to Discord failed Error: Failed"));
});
