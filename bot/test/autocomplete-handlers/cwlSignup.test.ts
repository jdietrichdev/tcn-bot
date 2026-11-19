import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import {
  findCwlSignupByName,
  listCwlSignups,
} from "../../src/util/cwlSignupStore";
import { handleCwlSignupAutocomplete } from "../../src/autocomplete-handlers/cwlSignup";

jest.mock("../../src/util/cwlSignupStore", () => ({
  findCwlSignupByName: jest.fn(),
  listCwlSignups: jest.fn(),
}));

const createInteraction = (
  options: Array<Record<string, unknown>>
) =>
  ({
    guild_id: "guild",
    data: { name: "cwl-add-clan", options },
  }) as unknown as APIApplicationCommandAutocompleteInteraction;

describe("CWL signup autocomplete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("suggests matching signup names", async () => {
    jest.mocked(listCwlSignups).mockResolvedValue([
      {
        pk: "guild",
        sk: "signup#november",
        signupName: "November CWL",
        clans: [],
      },
      {
        pk: "guild",
        sk: "signup#december",
        signupName: "December CWL",
        clans: [],
      },
    ]);

    const response = await handleCwlSignupAutocomplete(
      createInteraction([
        {
          name: "name",
          type: 3,
          value: "nov",
          focused: true,
        },
      ])
    );

    expect(response.data.choices).toEqual([
      { name: "November CWL", value: "November CWL" },
    ]);
  });

  it("suggests clan names and tags while excluding clans already in the signup", async () => {
    jest.mocked(findCwlSignupByName).mockResolvedValue({
      pk: "guild",
      sk: "signup#november",
      signupName: "November CWL",
      clans: [
        {
          name: "MiniPoint",
          tag: "2CYP9C9QG",
          league: "Master League I",
          link: "https://example.com",
        },
      ],
    });

    const response = await handleCwlSignupAutocomplete(
      createInteraction([
        {
          name: "signup-name",
          type: 3,
          value: "November CWL",
        },
        {
          name: "clan-tag",
          type: 3,
          value: "#2CLL",
          focused: true,
        },
      ])
    );

    expect(response.data.choices).toContainEqual({
      name: "AlphaPoint (#2CLL8UJR2)",
      value: "2CLL8UJR2",
    });
    expect(response.data.choices).not.toContainEqual(
      expect.objectContaining({ value: "2CYP9C9QG" })
    );
  });
});
