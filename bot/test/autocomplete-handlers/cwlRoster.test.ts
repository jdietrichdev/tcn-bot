import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleCwlRoster } from "../../src/autocomplete-handlers/cwlRoster";
import { s3Client } from "../../src/clients/s3-client";

jest.mock("../../src/clients/s3-client");

beforeEach(() => {
  jest.mocked(s3Client.send).mockImplementation(() => {
    return {
      Name: "bot-roster-bucket",
      Contents: [
        { Key: "guildId/roster.csv" },
        { Key: "guildId/otherRoster.csv" },
      ],
    };
  });
});

test("should call s3Client with correct parameters when focused option is roster", async () => {
  await handleCwlRoster(buildInteraction("roster", ""));
  expect(s3Client.send).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        Bucket: "bot-roster-bucket",
        Prefix: "guildId/",
        Delimiter: "/",
      },
    })
  );
});

test("should filter object-level key from options when focused option is roster", async () => {
  jest.mocked(s3Client.send).mockImplementation(() => {
    return {
      Name: "bot-roster-bucket",
      Contents: [{ Key: "guildId/roster.csv" }, { Key: "guildId/" }],
    };
  });
  const response = await handleCwlRoster(buildInteraction("roster", ""));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "roster",
          value: "roster",
        },
      ],
    },
  });
});

test("should return options when focused option is roster and no input", async () => {
  const response = await handleCwlRoster(buildInteraction("roster", ""));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "roster",
          value: "roster",
        },
        { name: "otherRoster", value: "otherRoster" },
      ],
    },
  });
});

test("should return filtered options when focused option is roster and input provided", async () => {
  const response = await handleCwlRoster(buildInteraction("roster", "oth"));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "otherRoster",
          value: "otherRoster",
        },
      ],
    },
  });
});

test("should return no options when focused option is roster and incorrect input provided", async () => {
  const response = await handleCwlRoster(
    buildInteraction("roster", "something else")
  );
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [],
    },
  });
});

test("should throw error when focused option does not have a handler", async () => {
  await expect(
    handleCwlRoster(buildInteraction("invalid", ""))
  ).rejects.toThrow(
    new Error("No handler defined for autocomplete interaction")
  );
});

const buildInteraction = (name: string, value: string) => {
  return {
    guild_id: "guildId",
    data: {
      options: [
        {
          name,
          value,
          focused: true,
        },
      ],
    },
  } as APIApplicationCommandAutocompleteInteraction;
};
