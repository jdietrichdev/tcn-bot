import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";

export const handleTest = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "emoji":
        return await emoji(interaction);
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const emoji = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  await updateResponse(interaction.application_id, interaction.token, {
    content: "Test emoji: <:yeti:1301957376034865154>",
  });
};
