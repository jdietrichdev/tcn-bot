import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleAutocomplete } from "../../src/autocomplete-handlers";
import { handleUpgrade } from "../../src/autocomplete-handlers/handlers";

jest.mock("../../src/autocomplete-handlers/handlers");

test("should call handleUpgrade when autocomplete interaction is for upgrade", async () => {
  const interaction = buildInteraction("upgrade");
  await handleAutocomplete(interaction);
  expect(handleUpgrade).toHaveBeenCalledWith(interaction);
});

test("should return options when autocomplete interaction is for upgrade", async () => {
  jest.mocked(handleUpgrade).mockResolvedValue({
    type: 8,
    data: { choices: [{ name: "test", value: "test" }] },
  });
  const response = await handleAutocomplete(buildInteraction("upgrade"));
  expect(response).toEqual({
    type: 8,
    data: { choices: [{ name: "test", value: "test" }] },
  });
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
