import { updateMessage } from "../../src/adapters/discord-adapter";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_URL = "https://discord.com/api/v10";

test("updateMessage should call patch with correct parameters", async () => {
  await updateMessage("appId", "token", { content: "test" });
  expect(mockedAxios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`,
    { content: "test" }
  );
});

test("updateMessage should throw error when request fails", async () => {
  mockedAxios.patch.mockImplementation(() => {
    throw new Error("Failed");
  });
  await expect(() =>
    updateMessage("appId", "token", { content: "test" })
  ).rejects.toThrow(new Error("Failed to update message: Error: Failed"));
});
