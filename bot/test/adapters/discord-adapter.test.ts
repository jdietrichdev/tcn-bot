import { updateResponse } from "../../src/adapters/discord-adapter";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_URL = "https://discord.com/api/v10";

test("updateResponse should call patch with correct parameters", async () => {
  await updateResponse("appId", "token", { content: "test" });
  expect(mockedAxios.patch).toHaveBeenCalledWith(
    `${BASE_URL}/webhooks/appId/token/messages/@original`,
    { content: "test" }
  );
});

test("updateResponse should throw error when request fails", async () => {
  mockedAxios.patch.mockImplementation(() => {
    throw new Error("Failed");
  });
  await expect(() =>
    updateResponse("appId", "token", { content: "test" })
  ).rejects.toThrow(new Error("Failed to update response: Error: Failed"));
});
