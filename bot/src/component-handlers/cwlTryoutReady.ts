import {
  APIMessageComponentInteraction,
  ChannelType,
} from "discord-api-types/v10";
import { getChannel, sendMessage, updateResponse } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";

export const notifyCwlTryoutStaff = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    if (!interaction.guild_id || !interaction.member) {
      throw new Error("CWL tryout notifications require a server member.");
    }
    const channel = await getChannel(interaction.channel.id);
    const topic = channel.type === ChannelType.GuildText ? channel.topic : null;
    const ticket = typeof topic === "string"
      ? /^CWL tryout for ([^:]+):([^:]+)$/.exec(topic)
      : null;
    if (!ticket || ticket[2] !== interaction.member.user.id) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Only the player assigned to this open tryout ticket can notify staff.",
      });
      return;
    }
    const roles = [...new Set(getConfig(interaction.guild_id).CWL_TRYOUT_STAFF_ROLES ?? [])]
      .filter(Boolean);
    if (!roles.length) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "CWL tryout staff roles are not configured. Please contact an admin.",
      });
      return;
    }
    await sendMessage({
      content: roles.map((role) => `<@&${role}>`).join(" "),
      allowed_mentions: { parse: [], roles },
      embeds: [{
        title: "Ready for a CWL Tryout",
        description: `<@${ticket[2]}> is ready to try out with ${ticket[1]}.`,
        color: 0xd4a017,
      }],
    }, interaction.channel.id);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "CWL tryout staff have been notified.",
    });
  } catch (error) {
    console.error("Failed to notify CWL tryout staff:", error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Could not notify CWL tryout staff. Please try again.",
    });
  }
};
