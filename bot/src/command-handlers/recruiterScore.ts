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
    const config = getConfig(
      typeof input === "string" ? input : input.guild_id!
    );
    const scoreMap = new Map<string, Record<string, number>>();
    const totals = {
      candidateForwards: 0,
      messages: 0,
      clanPosts: 0,
    };

    await getCandidatesMessages(scoreMap, totals, config);
    await getClanPostsMessages(scoreMap, totals, config);

    console.log(JSON.stringify(Object.fromEntries(scoreMap)));
    const embed = buildEmbed(scoreMap, totals, config);
    await sendMessage(
      {
        embeds: [embed],
      },
      config.RECRUITER_CHANNEL
    );
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content: `Information has been compiled and sent to <#${config.RECRUITER_CHANNEL}>`,
      });
    }
  } catch (err) {
    console.error(`Failed to generate recruitment score: ${err}`);
    if (typeof input !== "string") {
      await updateResponse(input.application_id, input.token, {
        content:
          "There was a failure generating the recruitment score, please try again or contact admins for assistance",
      });
    } else {
      throw new Error("Failure generating recruitment score");
    }
  }
};

const getCandidatesMessages = async (
  scoreMap: Map<string, Record<string, number>>,
  totals: Record<string, number>,
  config: ServerConfig
) => {
  const messages = await getChannelMessages(
    config.RECRUITMENT_OPP_CHANNEL,
    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
  );
  for (const message of messages) {
    if (
      message.type === MessageType.Default &&
      message.content.startsWith(
        "https://discord.com/channels/236523452230533121/1058589660798013440"
      )
    ) {
      totals.candidateForwards++;
      if (message.reactions?.some((reaction) => reaction.emoji.name === `✉️`)) {
        const userReactions = await getMessageReaction(
          message.channel_id,
          message.id,
          `✉️`
        );
        for (const user of userReactions) {
          if (
            user.username !== message.author.username &&
            user.username !== "O.T.T.O"
          ) {
            const stats = scoreMap.get(user.username) || {
              messages: 0,
              clanPosts: 0,
            };
            stats.messages++;
            scoreMap.set(user.username, stats);
            totals.messages++;
          }
        }
      }
    }
  }
};

const getClanPostsMessages = async (
  scoreMap: Map<string, Record<string, number>>,
  totals: Record<string, number>,
  config: ServerConfig
) => {
  const messages = await getChannelMessages(
    config.CLAN_POSTS_CHANNEL,
    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
  );
  for (const message of messages) {
    if (
      message.type === MessageType.Default &&
      message.content.startsWith(
        "https://discord.com/channels/236523452230533121/1058589765508800644"
      ) &&
      !message.message_reference
    ) {
      const user = message.embeds[0].title!.split(" ")[0];
      console.log(user);
      const stats = scoreMap.get(user) || {
        messages: 0,
        clanPosts: 0,
      };
      stats.clanPosts++;
      scoreMap.set(user, stats);
      totals.clanPosts++;
    }
  }
};

const buildEmbed = (
  scoreMap: Map<string, Record<string, number>>,
  totals: Record<string, number>,
  config: ServerConfig
) => {
  return {
    title: "Recruiter Scoring for Last Week",
    description: `Scores based on <#${config.RECRUITMENT_OPP_CHANNEL}> and <#${config.CLAN_POSTS_CHANNEL}>`,
    fields: Array.from(scoreMap, ([key, value]) => {
      return {
        name: `**${key}**`,
        value: [
          `Messages: ${value.messages}`,
          `Clan Posts: ${value.clanPosts}`,
        ].join("\n"),
      };
    }),
    footer: {
      text: [
        "**TOTALS**",
        `Candidate Forwards: ${totals.candidateForwards}`,
        `Messages Sent: ${totals.messages}`,
        `Clan Posts: ${totals.clanPosts}`,
      ].join("\n"),
    },
  } as APIEmbed;
};
