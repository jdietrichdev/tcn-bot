import {
  // APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";

export const handleHello = (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  console.log(interaction);
  // const userData = interaction.data.options?.find(
  //   (option) => option.name === "user"
  // ) as APIApplicationCommandInteractionDataUserOption;
};
