import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  getChannelMessages,
  updateResponse,
} from "../adapters/discord-adapter";

export const handleRecruiterScore = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const messages = await getChannelMessages(
      config.RECRUITMENT_OPP_CHANNEL,
      new Date("05/18/2025")
    );
    console.log(messages);
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure generating the recruitment score, please try again or contact admins for assistance",
    });
  }
};
