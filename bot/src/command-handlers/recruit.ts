import {
  AllowedMentionsTypes,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import { BUTTONS } from "../component-handlers/buttons";

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
    const notes =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "notes"
      );
    await sendMessage(
      {
        content: `<@&${config.recruiterRole}>`,
        embeds: [
          {
            title: "New potential recruit!",
            description: `${interaction.member?.user.username} recommends <@${userId.value}>\nNotes: ${notes.value}`,
          },
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [BUTTONS.MESSAGE_RECRUIT, BUTTONS.CLOSE_RECRUIT],
          },
        ],
        allowed_mentions: {
          parse: [AllowedMentionsTypes.Role],
          users: [userId.value],
        },
      },
      config.recruitmentOppChannel
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Thanks for your recommendation <@${interaction.member?.user.id}>`,
    });
  } catch (err) {
    console.error(`Failed to handle recruit command: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "Your request may have failed, if you do not see a message in the expected channel please try again",
    });
  }
};
