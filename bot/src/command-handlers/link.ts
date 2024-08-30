import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { getSubCommandOptionData } from "./utils";
import { verify } from "../adapters/coc-api-adapter";
import { updateMessage } from "../adapters/discord-adapter";

export const handleLink = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    switch (interaction.data.options![0].name) {
      case "create":
        return await linkPlayer(interaction);
      case "remove":
        return await unlinkPlayer(interaction);
      default:
        throw new Error("No processing defined for that command");
    }
  } catch (err) {
    console.log("Failure handling link command", err);
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
    verify(playerTag, apiToken);
    updateMessage(interaction.application_id, interaction.token, {
      content: "User successfully linked",
    });
  } catch (err) {
    console.log("Failure linking account", err);
    throw err;
  }
};

const unlinkPlayer = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const playerTag =
      getSubCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "remove",
        "tag"
      );
    console.log(playerTag);
    updateMessage(interaction.application_id, interaction.token, {
      content: "User successfully unlinked",
    });
  } catch (err) {
    console.log("Failure unlinking account", err);
    throw err;
  }
};
