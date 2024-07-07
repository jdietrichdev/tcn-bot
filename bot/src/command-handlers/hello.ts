import {
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { getCommandOptionData } from "./utils";
import { updateMessage } from "../adapters/discord-adapter";

export const handleHello = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const userData = getCommandOptionData(
      interaction,
      "user"
    ) as APIApplicationCommandInteractionDataUserOption;
    const response = { content: `Hello <@${userData.value}>!` };
    await updateMessage(
      interaction.application_id,
      interaction.token,
      response
    );
  } catch (err) {
    console.log("Failure handling hello command", err);
    throw err;
  }
};
