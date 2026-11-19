import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  TextInputStyle,
} from "discord-api-types/v10";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getPlayer } from "../adapters/coc-api-adapter";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  addCwlClanToSignup,
  canManageCwlDashboard,
} from "../component-handlers/cwlSignupDashboard";
import {
  buildCwlDashboardMessage,
  buildCwlRosterMessage,
  CwlRosterAccount,
} from "../util/cwlSignup";
import { loadTownHallEmojiMap } from "../util/townHallEmoji";
import { getCwlSignupById, saveCwlSignup, findCwlSignupByName } from "../util/cwlSignupStore";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const ephemeralResponse = (content: string): APIInteractionResponse => ({
  type: InteractionResponseType.ChannelMessageWithSource,
  data: {
    content,
    flags: MessageFlags.Ephemeral,
  },
});

const modalField = (
  customId: string,
  label: string,
  value: string,
  required: boolean,
  maxLength: number
) => ({
  type: ComponentType.ActionRow as const,
  components: [
    {
      type: ComponentType.TextInput as const,
      custom_id: customId,
      label,
      style: TextInputStyle.Short,
      value,
      required,
      max_length: maxLength,
    },
  ],
});

export const createCwlDashboardModal = async (
  interaction: APIMessageComponentInteraction
): Promise<APIInteractionResponse> => {
  if (!canManageCwlDashboard(interaction.guild_id, interaction.member)) {
    return ephemeralResponse("Only server admins can manage CWL signups.");
  }
  const [action, signupId, clanTag] = interaction.data.custom_id
    .replace("cwl_dashboard_", "")
    .split(":");
  if (!signupId || !interaction.guild_id) {
    return ephemeralResponse("This CWL signup could not be identified.");
  }

  const signup = await getCwlSignupById(interaction.guild_id, signupId);
  if (!signup) {
    return ephemeralResponse("This CWL signup no longer exists.");
  }

  if (action === "rename") {
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: `cwlDashboardModal:rename:${signupId}`,
        title: "Rename CWL signup",
        components: [
          modalField("signup_name", "Signup name", signup.signupName, true, 50),
        ],
      },
    };
  }

  if (action === "add_tag") {
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: `cwlDashboardModal:add_tag:${signupId}`,
        title: "Add clan to signup",
        components: [
          modalField("clan_tag", "Clan tag", "", true, 16),
        ],
      },
    };
  }

  if (
    (action === "add_player" || action === "remove_player") &&
    clanTag
  ) {
    const clan = signup.clans.find((item) => item.tag === clanTag);
    if (!clan) {
      return ephemeralResponse("The selected clan is no longer in this signup.");
    }
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: `cwlDashboardModal:${action}:${signupId}:${clanTag}`,
        title: action === "add_player" ? "Add linked player" : "Remove player",
        components: [
          modalField(
            "player_tag",
            "Clash of Clans player tag",
            "",
            true,
            16
          ),
        ],
      },
    };
  }

  if (action === "edit" && clanTag) {
    const clan = signup.clans.find((item) => item.tag === clanTag);
    if (!clan) {
      return ephemeralResponse("The selected clan is no longer in this signup.");
    }
    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: `cwlDashboardModal:edit:${signupId}:${clanTag}`,
        title: `Edit ${clan.name}`.slice(0, 45),
        components: [
          modalField("capacity", "Roster capacity (1-50)", String(clan.capacity ?? 50), true, 2),
          modalField(
            "minimum_th",
            "Minimum Town Hall (1-19)",
            String(clan.minTownHall ?? 15),
            true,
            2
          ),
          modalField(
            "role_id",
            "Role ID (blank to clear)",
            clan.roleId ?? "",
            false,
            20
          ),
        ],
      },
    };
  }
  return ephemeralResponse("Unsupported CWL dashboard action.");
};

const getTextInputValue = (
  interaction: APIModalSubmitInteraction,
  customId: string
) => {
  for (const row of interaction.data.components) {
    if (row.type !== ComponentType.ActionRow) {
      continue;
    }
    const input = row.components.find(
      (component) =>
        component.type === ComponentType.TextInput &&
        component.custom_id === customId
    );
    if (input?.type === ComponentType.TextInput) {
      return input.value;
    }
  }
  throw new Error(`Missing CWL dashboard form field: ${customId}.`);
};

const parseBoundedInteger = (
  value: string,
  name: string,
  min: number,
  max: number
) => {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
};

const refreshSignupMessages = async (
  signup: NonNullable<Awaited<ReturnType<typeof getCwlSignupById>>>
) => {
  if (signup.channelId) {
    for (const clan of signup.clans) {
      if (clan.messageId) {
        await updateMessage(
          signup.channelId,
          clan.messageId,
          buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
        );
      }
    }
  }
  if (signup.dashboardChannelId && signup.dashboardMessageId) {
    await updateMessage(
      signup.dashboardChannelId,
      signup.dashboardMessageId,
      buildCwlDashboardMessage(signup)
    );
  }
};

const normalizePlayerTag = (tag: string) =>
  `#${tag.replace(/^#/, "").toUpperCase()}`;

const getLinkedDiscordUser = async (playerTag: string) => {
  const response = await dynamoDbClient.send(
    new QueryCommand({
      TableName: "BotTable",
      IndexName: "sk-index",
      KeyConditionExpression: "sk = :sk",
      ExpressionAttributeValues: {
        ":sk": `player#${playerTag.replace(/^#/, "")}`,
      },
    })
  );
  const items: unknown = response.Items ?? [];
  if (!Array.isArray(items)) {
    throw new Error("Could not check linked accounts for that player tag.");
  }
  const linkedItems = items.filter(
    (
      item
    ): item is Record<string, unknown> & { pk: string; tag: string } =>
      isRecord(item) &&
      typeof item.pk === "string" &&
      typeof item.tag === "string" &&
      normalizePlayerTag(item.tag) === playerTag
  );
  if (linkedItems.length === 0) {
    throw new Error(
      `${playerTag} is not linked to the bot. Link it with \`/link create\` first.`
    );
  }
  if (linkedItems.length > 1) {
    throw new Error(`More than one Discord account is linked to ${playerTag}.`);
  }
  return linkedItems[0].pk;
};

const refreshRosterClanMessage = async (
  signup: NonNullable<Awaited<ReturnType<typeof getCwlSignupById>>>,
  clanTag: string
) => {
  const clan = signup.clans.find((item) => item.tag === clanTag);
  if (clan?.messageId && signup.channelId) {
    await updateMessage(
      signup.channelId,
      clan.messageId,
      buildCwlRosterMessage(signup, clan, loadTownHallEmojiMap())
    );
  }
  if (signup.dashboardChannelId && signup.dashboardMessageId) {
    await updateMessage(
      signup.dashboardChannelId,
      signup.dashboardMessageId,
      buildCwlDashboardMessage(signup, clanTag)
    );
  }
};

export const submitCwlDashboardModal = async (
  interaction: APIModalSubmitInteraction
) => {
  try {
    if (!canManageCwlDashboard(interaction.guild_id, interaction.member)) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Only server admins can manage CWL signups.",
      });
      return;
    }
    if (!interaction.guild_id) {
      throw new Error("CWL signups can only be managed in a server.");
    }
    const [, action, signupId, clanTag] =
      interaction.data.custom_id.split(":");
    const signup = await getCwlSignupById(interaction.guild_id, signupId);
    if (!signup) {
      throw new Error("This CWL signup no longer exists.");
    }

    if (action === "add_tag") {
      const { clan } = await addCwlClanToSignup(
        interaction.guild_id,
        signupId,
        getTextInputValue(interaction, "clan_tag")
      );
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Added **${clan.name}** to **${signup.signupName}**.`,
      });
      return;
    }

    if (
      (action === "add_player" || action === "remove_player") &&
      clanTag
    ) {
      const clan = signup.clans.find((item) => item.tag === clanTag);
      if (!clan) {
        throw new Error("The selected clan is no longer in this signup.");
      }
      const playerTag = normalizePlayerTag(
        getTextInputValue(interaction, "player_tag").trim()
      );
      if (!/^[A-Z0-9]{3,15}$/.test(playerTag.slice(1))) {
        throw new Error("Player tags must contain 3 to 15 letters or numbers.");
      }

      if (action === "add_player") {
        const alreadyAdded = (clan.accounts ?? []).some(
          (account) => normalizePlayerTag(account.playerTag) === playerTag
        );
        if (alreadyAdded) {
          throw new Error(`${playerTag} is already on the **${clan.name}** roster.`);
        }
        const userId = await getLinkedDiscordUser(playerTag);
        const playerData: unknown = await getPlayer(playerTag);
        if (!isRecord(playerData)) {
          throw new Error(`Could not read player data for ${playerTag}.`);
        }
        const account: CwlRosterAccount = {
          userId,
          playerTag,
          playerName:
            typeof playerData.name === "string" ? playerData.name : playerTag,
          clanName:
            isRecord(playerData.clan) &&
            typeof playerData.clan.name === "string"
              ? playerData.clan.name
              : undefined,
          townHallLevel:
            typeof playerData.townHallLevel === "number"
              ? playerData.townHallLevel
              : undefined,
        };
        clan.accounts = [...(clan.accounts ?? []), account];
      } else {
        const accounts = clan.accounts ?? [];
        const accountIndex = accounts.findIndex(
          (account) => normalizePlayerTag(account.playerTag) === playerTag
        );
        if (accountIndex < 0) {
          throw new Error(`${playerTag} is not on the **${clan.name}** roster.`);
        }
        accounts.splice(accountIndex, 1);
        clan.accounts = accounts;
      }

      await saveCwlSignup(signup);
      await refreshRosterClanMessage(signup, clanTag);
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          action === "add_player"
            ? `Added ${playerTag} to the **${clan.name}** roster.`
            : `Removed ${playerTag} from the **${clan.name}** roster.`,
      });
      return;
    }

    if (action === "rename") {
      const signupName = getTextInputValue(interaction, "signup_name").trim();
      if (!signupName || signupName.length > 50) {
        throw new Error("Signup names must be between 1 and 50 characters.");
      }
      const existing = await findCwlSignupByName(
        interaction.guild_id,
        signupName
      );
      if (existing && existing.sk !== signup.sk) {
        throw new Error(`A signup named "${signupName}" already exists.`);
      }
      signup.signupName = signupName;
      await saveCwlSignup(signup);
      await refreshSignupMessages(signup);
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Renamed the CWL signup to **${signupName}**.`,
      });
      return;
    }

    if (action === "edit" && clanTag) {
      const clan = signup.clans.find((item) => item.tag === clanTag);
      if (!clan) {
        throw new Error("The selected clan is no longer in this signup.");
      }
      clan.capacity = parseBoundedInteger(
        getTextInputValue(interaction, "capacity"),
        "Roster capacity",
        1,
        50
      );
      clan.minTownHall = parseBoundedInteger(
        getTextInputValue(interaction, "minimum_th"),
        "Minimum Town Hall",
        1,
        19
      );
      const roleValue = getTextInputValue(interaction, "role_id")
        .trim()
        .replace(/^<@&(\d+)>$/, "$1");
      if (roleValue && !/^\d{17,20}$/.test(roleValue)) {
        throw new Error("Role ID must be a valid Discord role ID or blank.");
      }
      clan.roleId = roleValue || undefined;
      await saveCwlSignup(signup);
      await refreshSignupMessages(signup);
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Updated settings for **${clan.name}**.`,
      });
      return;
    }
    throw new Error("Unsupported CWL dashboard form.");
  } catch (error) {
    console.error("Failed to submit CWL dashboard modal", error);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        error instanceof Error
          ? error.message
          : "Could not update the CWL signup. Please try again.",
    });
  }
};
