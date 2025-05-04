import {
  AllowedMentionsTypes,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ButtonStyle,
  ComponentType,
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
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: "Claim",
                custom_id: 'claimRecruit'
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
      "1368573341811740753"
    );
    await updateMessage(interaction.application_id, interaction.token, {
      content: `Thanks for your recommendation <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    throw new Error(`Failed to handle recruit command: ${err}`);
  }
};
