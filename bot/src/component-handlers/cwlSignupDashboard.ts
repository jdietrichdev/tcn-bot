import {
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  APIInteractionGuildMember,
  ComponentType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { getClan } from "../adapters/coc-api-adapter";
import {
  deleteMessage,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import {
  buildCwlDashboardMessage,
  buildCwlRosterMessage,
  CwlSignupClan,
  CwlSignupRecord,
  CWL_KNOWN_CLANS,
} from "../util/cwlSignup";
import { loadTownHallEmojiMap } from "../util/townHallEmoji";
import {
  getCwlSignupById,
  saveCwlSignup,
} from "../util/cwlSignupStore";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const canManageCwlDashboard = (
  guildId: string | undefined,
  member: APIInteractionGuildMember | null | undefined
) => {
  if (!guildId || !member) {
    return false;
  }
  const roles = member.roles;
  const permissions =
    "permissions" in member ? BigInt(member.permissions) : BigInt(0);
  const hasAdminRole = roles.includes(
    getConfig(guildId).ADMIN_ROLE
  );
  const hasAdminPermission =
    (permissions & BigInt(PermissionFlagsBits.Administrator)) !== BigInt(0);
  return hasAdminRole || hasAdminPermission;
};

const respond = async (
  interaction: APIMessageComponentInteraction,
  content: string
) =>
  updateResponse(interaction.application_id, interaction.token, { content });

const parseCustomId = (customId: string) => {
  if (customId.startsWith("cwl_roster_dashboard:")) {
    const signupId = customId.slice("cwl_roster_dashboard:".length);
    if (!signupId) {
      throw new Error("Invalid CWL dashboard interaction.");
    }
    return { action: "roster_dashboard", signupId, clanTag: undefined };
  }
  const parts = customId.split(":");
  if (parts.length < 2 || !parts[1]) {
    throw new Error("Invalid CWL dashboard interaction.");
  }
  return {
    action: parts[0].replace("cwl_dashboard_", ""),
    signupId: parts[1],
    clanTag: parts[2] || undefined,
  };
};

const getSignup = async (
  interaction: APIMessageComponentInteraction,
  signupId: string
) => {
  if (!interaction.guild_id) {
    throw new Error("CWL dashboards can only be used in a server.");
  }
  const signup = await getCwlSignupById(interaction.guild_id, signupId);
  if (!signup) {
    throw new Error("This CWL signup no longer exists.");
  }
  return signup;
};

const updateDashboard = async (
  signup: CwlSignupRecord,
  selectedClanTag?: string
) => {
  if (!signup.dashboardChannelId || !signup.dashboardMessageId) {
    throw new Error("The CWL dashboard message is no longer available.");
  }
  await updateMessage(
    signup.dashboardChannelId,
    signup.dashboardMessageId,
    buildCwlDashboardMessage(signup, selectedClanTag)
  );
};

const readClan = async (tag: string): Promise<CwlSignupClan> => {
  const clanData: unknown = await getClan(`#${tag}`);
  if (!isRecord(clanData) || !isRecord(clanData.warLeague)) {
    throw new Error(`Could not read the current CWL league for #${tag}.`);
  }
  if (
    typeof clanData.name !== "string" ||
    typeof clanData.tag !== "string" ||
    typeof clanData.warLeague.name !== "string"
  ) {
    throw new Error(`Clan #${tag} is missing name, tag, or league data.`);
  }
  const normalizedTag = clanData.tag.replace(/^#/, "").toUpperCase();
  return {
    name: clanData.name,
    tag: normalizedTag,
    league: clanData.warLeague.name,
    link: `https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${normalizedTag}`,
    accounts: [],
    capacity: 50,
    minTownHall: 15,
    signupOpen: true,
  };
};

export const addCwlClanToSignup = async (
  guildId: string,
  signupId: string,
  rawTag: string
) => {
  const tag = rawTag.replace(/^#/, "").toUpperCase();
  if (!/^[A-Z0-9]{3,15}$/.test(tag)) {
    throw new Error("Clan tags must contain 3 to 15 letters or numbers.");
  }
  const signup = await getCwlSignupById(guildId, signupId);
  if (!signup) {
    throw new Error("This CWL signup no longer exists.");
  }
  let clan = signup.clans.find((item) => item.tag === tag);
  if (!clan) {
    clan = await readClan(tag);
    signup.clans.push(clan);
    await saveCwlSignup(signup);
  }

  if (signup.status === "open" && signup.channelId && !clan.messageId) {
    const posted = await sendMessage(
      buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap()),
      signup.channelId
    );
    clan.messageId = posted.id;
    await saveCwlSignup(signup);
  }
  await updateDashboard(signup, tag);
  return { signup, clan };
};

const addClan = async (
  interaction: APIMessageComponentInteraction,
  signupId: string,
  rawTag: string
) => {
  if (!interaction.guild_id) {
    throw new Error("CWL dashboards can only be used in a server.");
  }
  const { clan } = await addCwlClanToSignup(
    interaction.guild_id,
    signupId,
    rawTag
  );
  await respond(
    interaction,
    `${clan.name} is ${clan.messageId ? "available on the roster" : "added to the signup"}.`
  );
};

export const handleCwlSignupDashboard = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    if (!canManageCwlDashboard(interaction.guild_id, interaction.member)) {
      await respond(
        interaction,
        "You need the server administrator permission or configured admin role to manage CWL signups."
      );
      return;
    }

    const { action, signupId, clanTag } = parseCustomId(
      interaction.data.custom_id
    );
    if (action === "roster_dashboard") {
      const signup = await getSignup(interaction, signupId);
      if (!interaction.channel_id) {
        throw new Error("Could not identify the dashboard channel.");
      }
      if (
        signup.dashboardMessageId &&
        signup.dashboardChannelId === interaction.channel_id
      ) {
        await updateDashboard(signup);
      } else {
        const posted = await sendMessage(
          buildCwlDashboardMessage(signup),
          interaction.channel_id
        );
        signup.dashboardChannelId = interaction.channel_id;
        signup.dashboardMessageId = posted.id;
        await saveCwlSignup(signup);
      }
      await respond(
        interaction,
        `CWL dashboard for **${signup.signupName}** is available in <#${interaction.channel_id}>.`
      );
      return;
    }

    if (action === "select") {
      if (
        interaction.data.component_type !== ComponentType.StringSelect
      ) {
        throw new Error("Expected a clan selection.");
      }
      const selectedTag = (
        interaction.data as APIMessageSelectMenuInteractionData
      ).values[0];
      if (!selectedTag) {
        throw new Error("No clan was selected.");
      }
      const signup = await getSignup(interaction, signupId);
      await updateDashboard(signup, selectedTag);
      await respond(interaction, `Selected **${selectedTag}** for editing.`);
      return;
    }

    if (action === "add") {
      if (
        interaction.data.component_type !== ComponentType.StringSelect
      ) {
        throw new Error("Expected a clan selection.");
      }
      const selectedTag = (
        interaction.data as APIMessageSelectMenuInteractionData
      ).values[0];
      if (!selectedTag || !CWL_KNOWN_CLANS.some((clan) => clan.tag === selectedTag)) {
        throw new Error("Select a clan from the provided list.");
      }
      await addClan(interaction, signupId, selectedTag);
      return;
    }

    const signup = await getSignup(interaction, signupId);
    if (action === "refresh") {
      await updateDashboard(signup, clanTag);
      await respond(interaction, "CWL dashboard refreshed.");
      return;
    }
    if (!clanTag) {
      throw new Error("Select a clan before using this dashboard action.");
    }
    const clanIndex = signup.clans.findIndex((clan) => clan.tag === clanTag);
    if (clanIndex < 0) {
      throw new Error("The selected clan is no longer part of this signup.");
    }
    const clan = signup.clans[clanIndex];

    if (action === "remove") {
      if (clan.messageId && signup.channelId) {
        await deleteMessage(signup.channelId, clan.messageId);
      }
      signup.clans.splice(clanIndex, 1);
      await saveCwlSignup(signup);
      await updateDashboard(signup);
      await respond(interaction, `Removed **${clan.name}** from this signup.`);
      return;
    }
    if (action === "toggle") {
      clan.signupOpen = clan.signupOpen === false;
      await saveCwlSignup(signup);
      if (clan.messageId && signup.channelId) {
        await updateMessage(
          signup.channelId,
          clan.messageId,
          buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
        );
      }
      await updateDashboard(signup, clanTag);
      await respond(
        interaction,
        `Signup for **${clan.name}** is ${clan.signupOpen ? "open" : "closed"}.`
      );
      return;
    }
    throw new Error("Unsupported CWL dashboard action.");
  } catch (error) {
    console.error("Failed to handle CWL signup dashboard interaction", error);
    await respond(
      interaction,
      error instanceof Error
        ? error.message
        : "Could not update the CWL dashboard. Please try again."
    );
  }
};

