import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

export const handleEvent = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "notify":
        return await eventNotify(interaction);
    }
  } catch (err) {
    console.log("Failure handling event command", err);
    throw err;
  }
};

const eventNotify = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  console.log(interaction);
};
