import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import { handleUpgrade } from "../../src/autocomplete-handlers/upgrade";

test('handleUpgrade should build options when focused option is troop and no input', async () => {
  const options = await handleUpgrade(buildInteraction("troop", ""));
  expect(options).toEqual({
    data: {
      choices: [
        { name: 'MINION', value: 'MINION' }
      ]
    }, type: 8 
  });
});

test('handleUpgrade should return filtered options when input provided', async () => {
  const options = await handleUpgrade(buildInteraction("troop", "Mi"));
  expect(options).toEqual({
    data: {
      choices: [
        { name: 'MINION', value: 'MINION' }
      ]
    },
    type: 8,
  });
});

test('handleUpgrade should return no options when input does not match any options', async () => {
  const options = await handleUpgrade(buildInteraction("troop", "Something"));
  expect(options).toEqual({
    data: {
      choices: [],
    },
    type: 8
  });
});

test('should throw error when focused option does not have a handler', async () => {
  await expect(
    handleUpgrade(buildInteraction("invalid", ""))
  ).rejects.toThrow(
    new Error("No handler defined for autocomplete interaction")
  );
})

const buildInteraction = (name: string, value: string) => {
  return {
    data: {
      options: [
        {
          name,
          value,
          focused: true
        }
      ]
    }
  } as APIApplicationCommandAutocompleteInteraction
}