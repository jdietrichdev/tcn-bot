import {
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  ComponentType,
} from "discord-api-types/v10";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getPlayer } from "../adapters/coc-api-adapter";
import { getPlayerCwlHistoryStats } from "../adapters/clashking-adapter";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getMessageSender } from "../util/interaction-util";
import { getConfig } from "../util/serverConfig";
import {
  getCwlLeagueRank,
  getCwlSignupReview,
  getCwlTryoutCategoryKey,
} from "../util/cwlSignupEligibility";
import { createCwlTryoutTicket } from "../util/cwlTryoutTicket";
import {
  buildCwlRosterMessage,
  buildLinkedAccountsEmbed,
  CwlLinkedAccountSummary,
  CwlRosterAccount,
  CwlSignupClan,
  getCwlSignupId,
  getCwlRosterCustomId,
} from "../util/cwlSignup";
import {
  getTownHallEmoji,
  loadTownHallEmojiMap,
} from "../util/townHallEmoji";
import {
  findCwlSignupByName,
  getCwlSignupById,
  saveCwlSignup,
} from "../util/cwlSignupStore";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePlayerTag = (tag: string) =>
  `#${tag.replace(/^#/, "").toUpperCase()}`;

const isClanTag = (value: string) => /^[A-Z0-9]{3,15}$/.test(value);

const parseCustomId = (
  customId: string,
  action: "signup" | "account" | "refresh" | "optout" | "optout_account"
) => {
  const prefix = `cwl_roster_${action}:`;
  if (!customId.startsWith(prefix)) {
    throw new Error("Invalid CWL roster interaction.");
  }
  const details = customId.slice(prefix.length);
  const separator = details.indexOf(":");
  if (separator <= 0 || separator === details.length - 1) {
    throw new Error("CWL roster interaction is missing its signup details.");
  }
  const first = details.slice(0, separator);
  const second = details.slice(separator + 1);
  if (isClanTag(first) && !isClanTag(second)) {
    return { clanTag: first, signupId: undefined, legacySignupName: second };
  }
  if (!isClanTag(second)) {
    throw new Error("CWL roster interaction contains an invalid clan tag.");
  }
  return { clanTag: second, signupId: first, legacySignupName: undefined };
};

const findLinkedAccounts = async (
  userId: string
): Promise<CwlLinkedAccountSummary[]> => {
  const response = await dynamoDbClient.send(
    new QueryCommand({
      TableName: "BotTable",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userId,
        ":prefix": "player#",
      },
    })
  );
  const items: unknown = response.Items ?? [];
  if (!Array.isArray(items)) {
    throw new Error("Could not read the user's linked accounts.");
  }
  return items
    .filter(
      (item): item is Record<string, unknown> & { tag: string } =>
        isRecord(item) && typeof item.tag === "string"
    )
    .map((item) => ({
      tag: normalizePlayerTag(item.tag),
      name: item.tag,
      heroes: {},
    }));
};

const getPlayerSummary = async (
  playerTag: string
): Promise<CwlLinkedAccountSummary & { clanName?: string }> => {
  const playerData: unknown = await getPlayer(playerTag);
  if (!isRecord(playerData)) {
    throw new Error(`Could not read player data for ${playerTag}.`);
  }
  const heroes: Record<string, number> = {};
  if (Array.isArray(playerData.heroes)) {
    for (const hero of playerData.heroes) {
      if (
        isRecord(hero) &&
        typeof hero.name === "string" &&
        typeof hero.level === "number"
      ) {
        heroes[hero.name] = hero.level;
      }
    }
  }
  const clanName =
    isRecord(playerData.clan) && typeof playerData.clan.name === "string"
      ? playerData.clan.name
      : undefined;

  return {
    tag: normalizePlayerTag(playerTag),
    name: typeof playerData.name === "string" ? playerData.name : playerTag,
    townHallLevel:
      typeof playerData.townHallLevel === "number"
        ? playerData.townHallLevel
        : undefined,
    heroes,
    clanName,
  };
};

const getSignup = async (
  interaction: APIMessageComponentInteraction,
  signupId: string | undefined,
  legacySignupName: string | undefined
) => {
  if (!interaction.guild_id) {
    throw new Error("CWL signup components can only be used in a server.");
  }
  return signupId
    ? getCwlSignupById(interaction.guild_id, signupId)
    : findCwlSignupByName(interaction.guild_id, legacySignupName ?? "");
};

const getClan = (signup: { clans: CwlSignupClan[] }, clanTag: string) =>
  signup.clans.find((clan) => clan.tag.toUpperCase() === clanTag);

const respondWithError = async (
  interaction: APIMessageComponentInteraction,
  context: string,
  error: unknown,
  message: string
) => {
  console.error(context, error);
  await updateResponse(interaction.application_id, interaction.token, {
    content: message,
  });
  throw error;
};

const addAccountToRoster = async (
  interaction: APIMessageComponentInteraction,
  signupId: string | undefined,
  legacySignupName: string | undefined,
  clanTag: string,
  selectedTag: string
) => {
  const userId = getMessageSender(interaction).id;
  const canonicalPlayerTag = normalizePlayerTag(selectedTag);
  const linkedAccounts = await findLinkedAccounts(userId);
  if (!linkedAccounts.some((account) => account.tag === canonicalPlayerTag)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "That account is no longer linked. Use `/link create` to link it, then try signing up again.",
    });
    return;
  }

  const signup = await getSignup(interaction, signupId, legacySignupName);
  if (!signup) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This CWL roster is no longer available for signup.",
    });
    return;
  }
  const clan = getClan(signup, clanTag);
  if (!clan?.messageId || typeof signup.channelId !== "string") {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This CWL roster is no longer available for signup.",
    });
    return;
  }
  if (clan.signupOpen === false) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Signup for **${clan.name}** is closed.`,
    });
    return;
  }

  const accountSummary = await getPlayerSummary(canonicalPlayerTag);
  const accounts: CwlRosterAccount[] = clan.accounts ?? [];
  if (
    accountSummary.townHallLevel !== undefined &&
    accountSummary.townHallLevel < (clan.minTownHall ?? 15)
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: `${accountSummary.name} is below the minimum Town Hall ${clan.minTownHall ?? 15} for **${clan.name}**.`,
    });
    return;
  }
  if (
    !accounts.some(
      (account) => normalizePlayerTag(account.playerTag) === canonicalPlayerTag
    ) &&
    accounts.length >= (clan.capacity ?? 50)
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: `The **${clan.name}** roster is full.`,
    });
    return;
  }

  const alreadySignedUp = accounts.some(
    (account) => normalizePlayerTag(account.playerTag) === canonicalPlayerTag
  );
  if (!alreadySignedUp) {
    const targetLeagueRank = getCwlLeagueRank(clan.league);
    const previousCwlStats =
      targetLeagueRank === undefined || targetLeagueRank > 15
        ? await getPlayerCwlHistoryStats(canonicalPlayerTag)
        : undefined;
    const review = getCwlSignupReview(clan.league, previousCwlStats);
    if (review.requiresTicket) {
      const guildId = interaction.guild_id;
      if (!guildId) {
        throw new Error("CWL tryout tickets can only be created in a server.");
      }
      const config = getConfig(guildId);
      const categoryKey = getCwlTryoutCategoryKey(clan.league);
      const categoryId =
        config.CWL_TRYOUT_CATEGORIES?.[categoryKey] ??
        config.CWL_TRYOUT_CATEGORIES?.default;
      if (!categoryId) {
        await updateResponse(interaction.application_id, interaction.token, {
          content: `This server has no CWL tryout ticket category configured for **${clan.league}**. Please contact an administrator; you have not been added to the roster.`,
        });
        return;
      }

      const ticket = await createCwlTryoutTicket({
        guildId,
        userId,
        username: getMessageSender(interaction).username,
        playerTag: canonicalPlayerTag,
        targetClan: clan.name,
        signupId: getCwlSignupId(signup),
        clanTag: clan.tag,
        targetLeague: clan.league,
        previousSeason: previousCwlStats?.season,
        previousLeague: previousCwlStats?.league,
        averageStars: previousCwlStats?.averageStars,
        reason: review.reason ?? "Staff review is required.",
        categoryId,
        config,
      });
      await updateResponse(interaction.application_id, interaction.token, {
        content: ticket.created
          ? `Staff review is required: ${review.reason}\nCreated a private tryout ticket: <#${ticket.channelId}>. You have not been added to the roster.`
          : `You already have an open tryout ticket: <#${ticket.channelId}>. You have not been added to the roster.`,
      });
      return;
    }

    accounts.push({
      userId,
      playerTag: canonicalPlayerTag,
      playerName: accountSummary.name,
      clanName: accountSummary.clanName,
      townHallLevel: accountSummary.townHallLevel,
    });
    clan.accounts = accounts;
    await saveCwlSignup(signup);
  }

  await updateMessage(
    signup.channelId,
    clan.messageId,
    buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
  );
  await updateResponse(interaction.application_id, interaction.token, {
    content: alreadySignedUp
      ? `${canonicalPlayerTag} is already on the **${clan.name}** roster.`
      : `Added ${accountSummary.name} (${canonicalPlayerTag}) to the **${clan.name}** roster.`,
  });
};

export const handleCwlRosterSignup = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupId, legacySignupName } = parseCustomId(
      interaction.data.custom_id,
      "signup"
    );
    const userId = getMessageSender(interaction).id;
    const linkedAccounts = await findLinkedAccounts(userId);
    if (linkedAccounts.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "You don't have any linked accounts yet. Use `/link create` to link a Clash of Clans account, then click the clan's signup button again.",
      });
      return;
    }
    if (linkedAccounts.length === 1) {
      await addAccountToRoster(
        interaction,
        signupId,
        legacySignupName,
        clanTag,
        linkedAccounts[0].tag
      );
      return;
    }
    if (linkedAccounts.length > 25) {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "Discord can show up to 25 accounts in the picker. Please unlink unused accounts before signing up.",
      });
      return;
    }

    const accountSummaries = await Promise.all(
      linkedAccounts.map((account) => getPlayerSummary(account.tag))
    );
    const townHallEmojiIds = loadTownHallEmojiMap();
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Select one linked account to add to this clan roster:",
      embeds: [buildLinkedAccountsEmbed(accountSummaries, townHallEmojiIds)],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: getCwlRosterCustomId(
                "account",
                clanTag,
                signupId ?? legacySignupName ?? ""
              ),
              placeholder: "Select accounts!",
              min_values: 1,
              max_values: 1,
              options: accountSummaries.map((account) => ({
                label: `${account.name} (${account.tag})`.slice(0, 100),
                value: account.tag,
                description: `Town Hall ${account.townHallLevel ?? "?"}`,
                emoji: getTownHallEmoji(
                  account.townHallLevel,
                  townHallEmojiIds
                ).componentEmoji,
              })),
            },
          ],
        },
      ],
    });
  } catch (err) {
    await respondWithError(
      interaction,
      "Failed to open CWL roster signup account picker",
      err,
      "Could not load linked accounts for this CWL signup. Please try again."
    );
  }
};

export const handleCwlRosterAccountSelect = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupId, legacySignupName } = parseCustomId(
      interaction.data.custom_id,
      "account"
    );
    if (interaction.data.component_type !== ComponentType.StringSelect) {
      throw new Error("Expected an account selection for CWL signup.");
    }
    const selectedTag = (
      interaction.data as APIMessageSelectMenuInteractionData
    ).values[0];
    if (!selectedTag) {
      throw new Error("No linked account was selected.");
    }
    await addAccountToRoster(
      interaction,
      signupId,
      legacySignupName,
      clanTag,
      selectedTag
    );
  } catch (err) {
    await respondWithError(
      interaction,
      "Failed to add selected account to CWL roster",
      err,
      "Could not add that account to the CWL roster. Please try again."
    );
  }
};

const updateRosterMessage = async (
  interaction: APIMessageComponentInteraction,
  signupId: string | undefined,
  legacySignupName: string | undefined,
  clanTag: string,
  content: string
) => {
  const signup = await getSignup(interaction, signupId, legacySignupName);
  const clan = signup && getClan(signup, clanTag);
  if (!signup || !clan?.messageId || !signup.channelId) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This CWL roster is no longer available.",
    });
    return;
  }
  await updateMessage(
    signup.channelId,
    clan.messageId,
    buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
  );
  await updateResponse(interaction.application_id, interaction.token, {
    content,
  });
};

export const handleCwlRosterRefresh = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupId, legacySignupName } = parseCustomId(
      interaction.data.custom_id,
      "refresh"
    );
    await updateRosterMessage(
      interaction,
      signupId,
      legacySignupName,
      clanTag,
      "Roster refreshed."
    );
  } catch (err) {
    await respondWithError(
      interaction,
      "Failed to refresh CWL roster",
      err,
      "Could not refresh this CWL roster. Please try again."
    );
  }
};

export const handleCwlRosterOptOut = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupId, legacySignupName } = parseCustomId(
      interaction.data.custom_id,
      "optout"
    );
    const signup = await getSignup(interaction, signupId, legacySignupName);
    const clan = signup && getClan(signup, clanTag);
    if (!signup || !clan) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "This CWL roster is no longer available.",
      });
      return;
    }
    const userId = getMessageSender(interaction).id;
    const ownAccounts = (clan.accounts ?? []).filter(
      (account) => account.userId === userId
    );
    if (ownAccounts.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "You don't have an account on this roster.",
      });
      return;
    }
    if (ownAccounts.length === 1) {
      await removeAccountFromRoster(interaction, signup, clan, ownAccounts[0]);
      return;
    }
    const signupIdForMenu = signup.sk.slice("signup#".length);
    await updateResponse(interaction.application_id, interaction.token, {
      content: `Select the **${clan.name}** roster account to remove:`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: getCwlRosterCustomId(
                "optout_account",
                clanTag,
                signupIdForMenu
              ),
              placeholder: "Select an account to opt out",
              min_values: 1,
              max_values: 1,
              options: ownAccounts.map((account) => ({
                label: `${account.playerName ?? account.playerTag} (${account.playerTag})`.slice(
                  0,
                  100
                ),
                value: account.playerTag,
              })),
            },
          ],
        },
      ],
    });
  } catch (err) {
    await respondWithError(
      interaction,
      "Failed to open CWL roster opt-out picker",
      err,
      "Could not load your roster accounts. Please try again."
    );
  }
};

const removeAccountFromRoster = async (
  interaction: APIMessageComponentInteraction,
  signup: NonNullable<Awaited<ReturnType<typeof getCwlSignupById>>>,
  clan: CwlSignupClan,
  account: CwlRosterAccount
) => {
  clan.accounts = (clan.accounts ?? []).filter(
    (rosterAccount) =>
      !(
        rosterAccount.userId === account.userId &&
        rosterAccount.playerTag === account.playerTag
      )
  );
  await saveCwlSignup(signup);
  if (clan.messageId && signup.channelId) {
    await updateMessage(
      signup.channelId,
      clan.messageId,
      buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
    );
  }
  await updateResponse(interaction.application_id, interaction.token, {
    content: `Removed ${account.playerTag} from the **${clan.name}** roster.`,
  });
};

export const handleCwlRosterOptOutSelect = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupId } = parseCustomId(
      interaction.data.custom_id,
      "optout_account"
    );
    if (interaction.data.component_type !== ComponentType.StringSelect) {
      throw new Error("Expected an account selection for roster opt-out.");
    }
    const playerTag = (
      interaction.data as APIMessageSelectMenuInteractionData
    ).values[0];
    if (!playerTag) {
      throw new Error("No roster account was selected.");
    }
    if (!signupId || !interaction.guild_id) {
      throw new Error("CWL signup is no longer available.");
    }
    const signup = await getCwlSignupById(interaction.guild_id, signupId);
    const clan = signup && getClan(signup, clanTag);
    const userId = getMessageSender(interaction).id;
    const account = clan?.accounts?.find(
      (rosterAccount) =>
        rosterAccount.userId === userId &&
        normalizePlayerTag(rosterAccount.playerTag) ===
          normalizePlayerTag(playerTag)
    );
    if (!signup || !clan || !account) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "That account is no longer on this roster.",
      });
      return;
    }
    await removeAccountFromRoster(interaction, signup, clan, account);
  } catch (err) {
    await respondWithError(
      interaction,
      "Failed to remove account from CWL roster",
      err,
      "Could not remove that account from the roster. Please try again."
    );
  }
};
