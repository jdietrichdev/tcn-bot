import { APIChatInputApplicationCommandInteraction, MessageType } from "discord-api-types/v10";
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
      new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000)
    );
    console.log(messages);
    for (const message of messages) {
      if (message.type === MessageType.ChatInputCommand &&
          message.embeds[0].title != "You're on Cooldown"
      ) {
        console.log("Bump: " + JSON.stringify(message));
        console.log("User: " + message.interaction_metadata?.user.username);
      } else if (message.type === MessageType.Default && message.message_reference) {
        console.log("Forward: " + JSON.stringify(message));
        console.log("User: " + message.author.username);
        console.log("Reactions: " + JSON.stringify(message.reactions));
      }
    }
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure generating the recruitment score, please try again or contact admins for assistance",
    });
  }
};
