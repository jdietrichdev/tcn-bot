import axios from "axios";
import { getPlayerCwlHistoryStats } from "../../src/adapters/clashking-adapter";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  isAxiosError: jest.fn(),
}));

describe("ClashKing CWL history adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("summarizes attacks and league from the latest season", async () => {
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: {
        items: [
          {
            season: "2026-09",
            clan: { warLeague: { name: "Master League I" } },
            attacks: [{ stars: 0 }, { stars: 0 }],
          },
          {
            season: "2026-10",
            clan: { warLeague: { name: "Champion League II" } },
            attacks: [
              { stars: 2, destructionPercentage: 80 },
              { stars: 3, destructionPercentage: 100 },
              { stars: 1, destructionPercentage: 50 },
            ],
          },
        ],
      },
    } as never);

    await expect(getPlayerCwlHistoryStats("#PLAYER1")).resolves.toEqual({
      season: "2026-10",
      league: "Champion League II",
      averageStars: 2,
      totalStars: 6,
      totalDestruction: 230,
      attackCount: 3,
    });
    expect(jest.mocked(axios.get)).toHaveBeenCalledWith(
      "https://api.clashk.ing/v2/player/%23PLAYER1/cwl/history",
      { params: { limit: 20 }, timeout: 10000 }
    );
  });

  it("returns undefined when ClashKing has no CWL history", async () => {
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: { items: [] },
    } as never);

    await expect(getPlayerCwlHistoryStats("#PLAYER1")).resolves.toBeUndefined();
  });
});
