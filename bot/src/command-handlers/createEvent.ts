import {
  APIApplicationCommandInteractionDataAttachmentOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
// import { getConfig } from "../util/serverConfig";
import { getCommandOptionData } from "../util/interaction-util";

export const createEvent = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    // const config = getConfig(interaction.guild_id!);
    const eventData = getEventData(interaction);
    console.log(eventData);
  } catch (err) {
    throw err;
  }
};

const getEventData = (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  return {
    name: getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "name"
    ).value,
    channelType:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "type"
      ).value,
    start:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "start"
      ).value,
    end: getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "end"
    ).value,
    description:
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "description"
      ).value,
    thumbnail:
      getCommandOptionData<APIApplicationCommandInteractionDataAttachmentOption>(
        interaction,
        "thumbnail"
      ).value,
  };
};
