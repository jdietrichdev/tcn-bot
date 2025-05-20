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
    const scoreMap = new Map<string, Record<string, number>>();
    const messages = await getChannelMessages(
      config.RECRUITMENT_OPP_CHANNEL,
      new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000)
    );
    console.log(messages);
    for (const message of messages) {
      if (message.type === MessageType.ChatInputCommand &&
          message.embeds[0].title != "You're on Cooldown"
      ) {
        const user = message.interaction_metadata!.user.username;
        const stats = scoreMap.get(user) || { bump: 0, forward: 0, reachOut: 0 };
        stats.bump++;
        scoreMap.set(user, stats);
        console.log("Bump user: " + message.interaction_metadata?.user.username);
      } else if (message.type === MessageType.Default && message.message_reference) {
        const user = message.author.username;
        const stats = scoreMap.get(user) || { bump: 0, forward: 0, reachOut: 0 };
        stats.forward++;
        scoreMap.set(user, stats);
        console.log("Forward user: " + message.author.username);
        console.log("Reactions: " + JSON.stringify(message.reactions));
      }
      console.log(JSON.stringify(Object.fromEntries(scoreMap)));
    }
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure generating the recruitment score, please try again or contact admins for assistance",
    });
  }
};
