import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleNominationResult } from "../../src/autocomplete-handlers/nominationResult";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";

jest.mock("../../src/clients/dynamodb-client");

beforeEach(() => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        proposals: [
          {
            rank: "Lead",
            type: "Promotion",
            username: "testUser",
            message: "promotionMessage",
          },
        ],
      },
    };
  });
});

afterEach(jest.resetAllMocks);

test("should call dynamoDbClient with correct params when focused option is proposal", async () => {
  await handleNominationResult(buildInteraction("proposal", ""));
  expect(dynamoDbClient.send).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        TableName: "BotTable",
        Key: {
          pk: "guildId",
          sk: "rank-proposals",
        },
      },
    })
  );
});

test("should filter out proposals with result from options when focused option is proposal", async () => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        proposals: [
          {
            rank: "Elder",
            type: "Demotion",
            username: "demoted",
            message: "demotionMessage",
            result: "Approve",
          },
          {
            rank: "Lead",
            type: "Promotion",
            username: "testUser",
            message: "promotionMessage",
          },
        ],
      },
    };
  });
  const response = await handleNominationResult(
    buildInteraction("proposal", "")
  );
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "Lead Promotion - testUser",
          value: "promotionMessage",
        },
      ],
    },
  });
});

test("should return options when focused option is proposal and no input", async () => {
  const response = await handleNominationResult(
    buildInteraction("proposal", "")
  );
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "Lead Promotion - testUser",
          value: "promotionMessage",
        },
      ],
    },
  });
});

test("should return filtered option when focused option is proposal and input provided", async () => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        proposals: [
          {
            rank: "Elder",
            type: "Demotion",
            username: "demoted",
            message: "demotionMessage",
          },
          {
            rank: "Lead",
            type: "Promotion",
            username: "testUser",
            message: "promotionMessage",
          },
        ],
      },
    };
  });
  const response = await handleNominationResult(
    buildInteraction("proposal", "prom")
  );
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [
        {
          name: "Lead Promotion - testUser",
          value: "promotionMessage",
        },
      ],
    },
  });
});

test("should return no options when focused option is proposal and incorrect input provided", async () => {
  const response = await handleNominationResult(
    buildInteraction("proposal", "invalid")
  );
  expect(response).toEqual({
    type: 8,
    data: { choices: [] },
  });
});

test("should throw error when focused option does not have a handler", async () => {
  await expect(
    handleNominationResult(buildInteraction("invalid", ""))
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
