import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleAutocomplete } from "../../src/autocomplete-handlers";
import {
  handleCwlRoster,
  handleLink,
  handleNominationResult,
  handleQuestionAnswer,
  handleQuestionClose,
  handleUpgrade,
} from "../../src/autocomplete-handlers/handlers";

jest.mock("../../src/autocomplete-handlers/handlers");

const mockReturnValue = {
  type: 8,
  data: { choices: [{ name: "test", value: "test" }] },
};

test("should call handleUpgrade when autocomplete interaction is for upgrade", async () => {
  const interaction = buildInteraction("upgrade");
  await handleAutocomplete(interaction);
  expect(handleUpgrade).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for upgrade", async () => {
  jest.mocked(handleUpgrade).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(buildInteraction("upgrade"));
  expect(response).toEqual(mockReturnValue);
});

test("should call handleCwlRoster when interaction is for cwl-roster", async () => {
  const interaction = buildInteraction("cwl-roster");
  await handleAutocomplete(interaction);
  expect(handleCwlRoster).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for cwl-roster", async () => {
  jest.mocked(handleCwlRoster).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(buildInteraction("cwl-roster"));
  expect(response).toEqual(mockReturnValue);
});

test("should call handleLink when interaction is for link", async () => {
  const interaction = buildInteraction("link");
  await handleAutocomplete(interaction);
  expect(handleLink).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for link", async () => {
  jest.mocked(handleLink).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(buildInteraction("cwl-roster"));
  expect(response).toEqual(mockReturnValue);
});

test("should call handleNominationResult when interaction is for nomination-result", async () => {
  const interaction = buildInteraction("nomination-result");
  await handleAutocomplete(interaction);
  expect(handleNominationResult).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for nomination-result", async () => {
  jest.mocked(handleNominationResult).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(
    buildInteraction("nomination-result")
  );
  expect(response).toEqual(mockReturnValue);
});

test("should call handleQuestionClose when interaction is for question-close", async () => {
  const interaction = buildInteraction("question-close");
  await handleAutocomplete(interaction);
  expect(handleQuestionClose).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for question-close", async () => {
  jest.mocked(handleQuestionClose).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(buildInteraction("question-close"));
  expect(response).toEqual(mockReturnValue);
});

test("should call handleQuestionAnswer when interaction is for question-answer", async () => {
  const interaction = buildInteraction("question-answer");
  await handleAutocomplete(interaction);
  expect(handleQuestionAnswer).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for question-answer", async () => {
  jest.mocked(handleQuestionAnswer).mockResolvedValue(mockReturnValue);
  const response = await handleAutocomplete(
    buildInteraction("question-answer")
  );
  expect(response).toEqual(mockReturnValue);
});

test("should throw error when no handler for autocomplete interaction", async () => {
  const interaction = buildInteraction("not-found");
  await expect(handleAutocomplete(interaction)).rejects.toThrow(
    new Error("No autocomplete process defined")
  );
});

test("should throw error when failure handling autocomplete", async () => {
  jest.mocked(handleUpgrade).mockRejectedValue(new Error("Failed"));
  await expect(handleAutocomplete(buildInteraction("upgrade"))).rejects.toThrow(
    new Error("Failed")
  );
});

const buildInteraction = (name: string) => {
  return {
    data: {
      name,
    },
  } as APIApplicationCommandAutocompleteInteraction;
};
