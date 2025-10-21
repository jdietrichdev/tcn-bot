import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleQuestionAnswer } from "../../src/autocomplete-handlers/questionAnswer";
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

describe("focused option is question", () => {
  test("should call dynamodb with correct parameters", async () => {
    await handleQuestionAnswer(buildInteraction("question", ""));
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

  test("should filter out questions with an answer", async () => {
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
              question: "Other question",
              id: "0987654321",
              option1: "one",
              option2: "two",
              answer: "one",
            },
          ],
        },
      };
    });
    const response = await handleQuestionAnswer(
      buildInteraction("question", "")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [{ name: "What?", value: "1234567890" }],
      },
    });
  });

  test("should return options when no input provided", async () => {
    const response = await handleQuestionAnswer(
      buildInteraction("question", "")
    );
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
              question: "Other question",
              id: "0987654321",
              option1: "one",
              option2: "two",
            },
          ],
        },
      };
    });
    const response = await handleQuestionAnswer(
      buildInteraction("question", "other")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [{ name: "Other question", value: "0987654321" }],
      },
    });
  });

  test("should return no options when incorrect input provided", async () => {
    const response = await handleQuestionAnswer(
      buildInteraction("question", "invalid")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [],
      },
    });
  });

  test("should provide filtered options when input provided", async () => {
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
              question: "Other question",
              id: "0987654321",
              option1: "one",
              option2: "two",
            },
          ],
        },
      };
    });
    const response = await handleQuestionAnswer(
      buildInteraction("question", "othe")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [{ name: "Other question", value: "0987654321" }],
      },
    });
  });
});

describe("focused option is answer", () => {
  test("should call dynamodb with correct parameters", async () => {
    await handleQuestionAnswer(buildInteraction("answer", ""));
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

  test("should return options when no input provided", async () => {
    const response = await handleQuestionAnswer(buildInteraction("answer", ""));
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [
          { name: "one", value: "one" },
          { name: "two", value: "two" },
          { name: "three", value: "three" },
          { name: "four", value: "four" },
        ],
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
              question: "Other question",
              id: "0987654321",
              option1: "one",
              option2: "two",
            },
          ],
        },
      };
    });
    const response = await handleQuestionAnswer(
      buildInteraction("answer", "o")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [
          { name: "one", value: "one" },
          { name: "two", value: "two" },
          { name: "four", value: "four" },
        ],
      },
    });
  });

  test("should return no options when incorrect input provided", async () => {
    const response = await handleQuestionAnswer(
      buildInteraction("answer", "invalid")
    );
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [],
      },
    });
  });

  test("should throw error when question is not answered", async () => {
    const interaction = buildInteraction("answer", "");
    delete interaction.data.options[1];
    await expect(handleQuestionAnswer(interaction)).rejects.toThrow(
      "No response found for question parameter"
    );
  });
});

test("should throw error when focused option does not have a handler", async () => {
  await expect(
    handleQuestionAnswer(buildInteraction("invalid", ""))
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
        ...((name === "answer" && [
          {
            name: "question",
            value: "1234567890",
          },
        ]) ||
          []),
      ],
    },
  } as APIApplicationCommandAutocompleteInteraction;
};
