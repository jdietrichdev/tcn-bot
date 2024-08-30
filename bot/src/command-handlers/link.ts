import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { getSubCommandOptionData } from "./utils";
import { verify } from "../adapters/coc-api-adapter";

export const handleLink = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "create":
        return await linkPlayer(interaction);
      // case "remove":
      //   return await unlinkPlayer(interaction);
      default:
        throw new Error("No processing defined for that command");
    }
  } catch (err) {
    console.log("Failure handling player command", err);
    throw err;
  }
};

const linkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const playerTag =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "create",
      "tag"
    ).value;
  const apiToken =
    getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "create",
      "token"
    ).value;

  try {
    const verifyResponse = verify(playerTag, apiToken);
    return verifyResponse;
  } catch (err) {
    console.log("Failure verifying account", err);
    throw err;
  }
};
