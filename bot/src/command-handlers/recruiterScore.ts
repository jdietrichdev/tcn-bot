import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  MessageType,
} from "discord-api-types/v10";
import { getConfig, ServerConfig } from "../util/serverConfig";
import {
  getChannelMessages,
  getMessageReaction,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";

export const handleRecruiterScore = async (
  input: APIChatInputApplicationCommandInteraction | string
) => {
  try {
    const config = getConfig(typeof input === 'string' ? input : input.guild_id!);
    const scoreMap = new Map<string, Record<string, number>>();
    const messages = await getChannelMessages(
      config.RECRUITMENT_OPP_CHANNEL,
      new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
    );
    for (const message of messages) {
      if (
        message.type === MessageType.ChatInputCommand &&
        message.embeds[0].title != "You're on Cooldown"
      ) {
        const user = message.interaction_metadata!.user.username;
        const stats = scoreMap.get(user) || {
          bump: 0,
          forward: 0,
          reachOut: 0,
        };
        stats.bump++;
        scoreMap.set(user, stats);
      } else if (
        message.type === MessageType.Default &&
        message.message_reference
      ) {
        const user = message.author.username;
        const stats = scoreMap.get(user) || {
          bump: 0,
          forward: 0,
          reachOut: 0,
        };
        stats.forward++;
        stats.reachOut++;
        scoreMap.set(user, stats);
        if (message.reactions?.some((reaction) => reaction.emoji.name === `✉️`)) {
          const userReactions = await getMessageReaction(message.channel_id, message.id, `✉️`);
          for (const user of userReactions) {
            if (user.username !== message.author.username) {
              const stats = scoreMap.get(user.username) || {
                bump: 0,
                forward: 0,
                reachOut: 0,
              };
              stats.reachOut++;
              scoreMap.set(user.username, stats);
            }
          }
        }
      }
    }
    console.log(JSON.stringify(Object.fromEntries(scoreMap)));
    const embed = buildEmbed(scoreMap, config);
    await sendMessage({
      embeds: [embed]
    }, config.RECRUITER_CHANNEL);
    if (typeof input !== 'string') {
      await updateResponse(input.application_id, input.token, {
        content: `Information has been compiled and sent to <#${config.RECRUITER_CHANNEL}>`
      });
    }
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    if (typeof input !== 'string') {
      await updateResponse(input.application_id, input.token, {
        content:
          "There was a failure generating the recruitment score, please try again or contact admins for assistance",
      });
    } else {
      throw new Error('Failure generating recruitment score');
    }
  }
};

const buildEmbed = (scoreMap: Map<string, Record<string, number>>, config: ServerConfig) => {
  return {
    title: "Recruiter Scoring for Last Week",
    description: `Scores based on participation in the <#${config.RECRUITMENT_OPP_CHANNEL}>`,
    fields: Array.from(scoreMap, ([key, value]) => {
      return {
        name: `**${key}**`,
        value: [
          `Bumps: ${value.bump}`,
          `Forwards: ${value.forward}`,
          `Reach Outs: ${value.reachOut}`,
          `**Score**: ${(value.bump * 5) + value.forward + value.reachOut}`
        ].join("\n")
      }
    }),
    footer: {
      text: "Who will be on top next week?"
    }
  } as APIEmbed;
}