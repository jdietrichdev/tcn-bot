import {
  AllowedMentionsTypes,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateMessage } from "../adapters/discord-adapter";

export const handleRecruit = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const userId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "user"
      );
    await sendMessage(
      {
        content: `<@&1367944733204152484>`,
        embeds: [
          {
            title: 'New potential recruit!',
            description: `${interaction.member?.user.username} recommends <@${userId.value}>`
          }
        ],
        allowed_mentions: {
          parse: [AllowedMentionsTypes.Role],
          users: [userId.value],
        },
      },
      "1367868025440833576"
    );
    await updateMessage(interaction.application_id, interaction.token, {
      content: `Thanks for your recommendation <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    throw new Error(`Failed to handle recruit command: ${err}`);
  }
};
