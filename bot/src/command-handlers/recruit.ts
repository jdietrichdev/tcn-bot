import {
  AllowedMentionsTypes,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage } from "../adapters/discord-adapter";

export const handleRecruit = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const userId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "user"
      );
    console.log(userId);
    console.log(userId.value);
    await sendMessage(
      {
        content: `<@${userId.value}>`,
        allowed_mentions: {
          parse: [],
          users: [userId.value],
        },
      },
      "1367868025440833576"
    );
  } catch (err) {
    throw new Error(`Failed to handle recruit command: ${err}`);
  }
};
