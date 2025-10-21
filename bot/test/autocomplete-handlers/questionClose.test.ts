import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleQuestionClose } from "../../src/autocomplete-handlers/questionClose";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";

jest.mock("../../src/clients/dynamodb-client");

beforeEach(() => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        questions: [
          {
            question: "What?",
            id: "1234567890",
            option1: "one",
            option2: "two",
            option3: "three",
            option4: "four",
          },
        ],
      },
    };
  });
});

test("should call dynamoDb with correct parameters when focused option is question", async () => {
  await handleQuestionClose(buildInteraction("question", ""));
  expect(dynamoDbClient.send).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        TableName: "BotTable",
        Key: {
          pk: "guildId",
          sk: "event#eventId",
        },
      },
    })
  );
});

test("should filter out questions that are closed", async () => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        questions: [
          {
            question: "What?",
            id: "1234567890",
            option1: "one",
            option2: "two",
            option3: "three",
            option4: "four",
          },
          {
            question: "closed",
            id: "123",
            option1: "one",
            option2: "two",
            closed: true,
          },
        ],
      },
    };
  });
  const response = await handleQuestionClose(buildInteraction("question", ""));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [{ name: "What?", value: "1234567890" }],
    },
  });
});

test("should filter out questions that are answered", async () => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        questions: [
          {
            question: "What?",
            id: "1234567890",
            option1: "one",
            option2: "two",
            option3: "three",
            option4: "four",
          },
          {
            question: "answered",
            id: "123",
            option1: "one",
            option2: "two",
            closed: true,
            answer: "one",
          },
        ],
      },
    };
  });
  const response = await handleQuestionClose(buildInteraction("question", ""));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [{ name: "What?", value: "1234567890" }],
    },
  });
});

test("should return options when no input provided", async () => {
  const response = await handleQuestionClose(buildInteraction("question", ""));
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [{ name: "What?", value: "1234567890" }],
    },
  });
});

test("should return filtered options when input provided", async () => {
  jest.mocked(dynamoDbClient.send).mockImplementation(() => {
    return {
      Item: {
        questions: [
          {
            question: "What?",
            id: "1234567890",
            option1: "one",
            option2: "two",
            option3: "three",
            option4: "four",
          },
          {
            question: "Second question",
            id: "123",
            option1: "one",
            option2: "two",
          },
        ],
      },
    };
  });
  const response = await handleQuestionClose(
    buildInteraction("question", "seco")
  );
  expect(response).toEqual({
    type: 8,
    data: {
      choices: [{ name: "Second question", value: "123" }],
    },
  });
});

test("should return no options when incorrect input provided", async () => {
  const response = await handleQuestionClose(
    buildInteraction("question", "invalid")
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
    handleQuestionClose(buildInteraction("invalid", ""))
  ).rejects.toThrow("No handler defined for autocomplete interaction");
});

const buildInteraction = (name: string, value: string) => {
  return {
    guild_id: "guildId",
    channel: {
      topic: "eventId",
    },
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
