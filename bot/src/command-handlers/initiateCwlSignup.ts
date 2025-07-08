import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { BUTTONS } from "../component-handlers/buttons";
import { getConfig } from "../util/serverConfig";

export const handleInitiateCwlSignup = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const signupName =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "name"
      ).value;

    const signupMessage = await sendMessage(
      {
        embeds: [
          {
            title: signupName,
            fields: [],
            footer: {
              text: "Total accounts: 0\nSignup is **open**",
            },
          },
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [BUTTONS.SIGNUP_CWL, BUTTONS.CLOSE_CWL_SIGNUP],
          },
        ],
      },
      config.CWL_SIGNUP_CHANNEL
    );
    console.log(signupMessage);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "CWL signup has been started",
    });
  } catch (err) {
    console.log(`Failed to initiate CWL signup: ${err}`);
    throw err;
  }
};
