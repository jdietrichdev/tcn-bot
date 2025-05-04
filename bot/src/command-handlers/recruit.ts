import {
  AllowedMentionsTypes,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateMessage } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";

export const handleRecruit = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const userId =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "user"
      );
    const notes = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "notes"
    )
    await sendMessage(
      {
        content: `<@&${config.RECRUITER_ROLE}>`,
        embeds: [
          {
            title: 'New potential recruit!',
            description: `${interaction.member?.user.username} recommends <@${userId.value}>\nNotes: ${notes.value}`
          }
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: "Messaged",
                custom_id: 'messageRecruit'
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: "Close",
                custom_id: "closeRecruit"
              },
            ]
          }
        ],
        allowed_mentions: {
          parse: [AllowedMentionsTypes.Role],
          users: [userId.value],
        },
      },
      config.RECRUITMENT_OPP_CHANNEL
    );
    await updateMessage(interaction.application_id, interaction.token, {
      content: `Thanks for your recommendation <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    throw new Error(`Failed to handle recruit command: ${err}`);
  }
};
