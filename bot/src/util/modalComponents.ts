import {
  APIModalSubmitInteraction,
  APIModalSubmitTextInputComponent,
  ComponentType,
  ModalSubmitComponent,
} from "discord-api-types/v10";

export const getModalTextInputs = (
  interaction: APIModalSubmitInteraction
): APIModalSubmitTextInputComponent[] => {
  const components: ModalSubmitComponent[] =
    interaction.data.components.flatMap((component) => {
      if (component.type === ComponentType.ActionRow) {
        return component.components;
      }
      if (component.type === ComponentType.Label) {
        return [component.component];
      }
      return [];
    });

  return components.filter(
    (component): component is APIModalSubmitTextInputComponent =>
      component.type === ComponentType.TextInput
  );
};

export const getModalTextInputValue = (
  interaction: APIModalSubmitInteraction,
  index = 0
): string => {
  const input = getModalTextInputs(interaction)[index];
  if (!input) {
    throw new Error("A required modal text input was missing.");
  }
  return input.value;
};
