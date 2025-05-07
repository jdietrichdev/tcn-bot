import {
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";

export const handleHello = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const userData =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "user"
      );
    const response = { content: `Hello <@${userData.value}>!` };
    await updateResponse(
      interaction.application_id,
      interaction.token,
      response
    );
  } catch (err) {
    console.log("Failure handling hello command", err);
    throw err;
  }
};
