import {
  APIEmbed,
  ButtonStyle,
  ComponentType,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { WAR_LEAGUE } from "../constants/emojis/coc/cwlLeague";
import { getTownHallEmoji } from "./townHallEmoji";

export interface CwlSignupClan {
  name: string;
  tag: string;
  league: string;
  link: string;
  accounts?: CwlRosterAccount[];
  messageId?: string;
  capacity?: number;
  minTownHall?: number;
  roleId?: string;
  signupOpen?: boolean;
}

export interface CwlRosterAccount {
  userId: string;
  playerTag: string;
  playerName?: string;
  clanName?: string;
  townHallLevel?: number;
  heroes?: Record<string, number>;
}

export interface CwlLinkedAccountSummary {
  tag: string;
  name: string;
  townHallLevel?: number;
  heroes: Record<string, number>;
}

export interface CwlSignupRecord {
  pk: string;
  sk: string;
  signupName: string;
  clans: CwlSignupClan[];
  channelId?: string;
  dashboardChannelId?: string;
  dashboardMessageId?: string;
  status?: "draft" | "open";
  [key: string]: unknown;
}

export interface CwlSignupEmbedData {
  signupName: string;
  accounts: Array<{
    username: string;
    playerTag: string;
  }>;
  clans?: CwlSignupClan[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCwlRosterAccount = (value: unknown): value is CwlRosterAccount =>
  isRecord(value) &&
  typeof value.userId === "string" &&
  typeof value.playerTag === "string" &&
  (value.playerName === undefined || typeof value.playerName === "string") &&
  (value.clanName === undefined || typeof value.clanName === "string") &&
  (value.townHallLevel === undefined ||
    typeof value.townHallLevel === "number") &&
  (value.heroes === undefined ||
    (isRecord(value.heroes) &&
      Object.values(value.heroes).every((level) => typeof level === "number")));

export const isCwlSignupClan = (value: unknown): value is CwlSignupClan =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.tag === "string" &&
  typeof value.league === "string" &&
  typeof value.link === "string" &&
  (value.messageId === undefined || typeof value.messageId === "string") &&
  (value.capacity === undefined || typeof value.capacity === "number") &&
  (value.minTownHall === undefined ||
    typeof value.minTownHall === "number") &&
  (value.roleId === undefined || typeof value.roleId === "string") &&
  (value.signupOpen === undefined || typeof value.signupOpen === "boolean") &&
  (value.accounts === undefined ||
    (Array.isArray(value.accounts) && value.accounts.every(isCwlRosterAccount)));

export const isCwlSignupRecord = (
  value: unknown
): value is CwlSignupRecord =>
  isRecord(value) &&
  typeof value.pk === "string" &&
  typeof value.sk === "string" &&
  typeof value.signupName === "string" &&
  Array.isArray(value.clans) &&
  value.clans.every(isCwlSignupClan) &&
  (value.channelId === undefined || typeof value.channelId === "string") &&
  (value.dashboardChannelId === undefined ||
    typeof value.dashboardChannelId === "string") &&
  (value.dashboardMessageId === undefined ||
    typeof value.dashboardMessageId === "string") &&
  (value.status === undefined ||
    value.status === "draft" ||
    value.status === "open");

export const getCwlRosterCustomId = (
  action: "signup" | "account" | "refresh" | "optout" | "optout_account",
  clanTag: string,
  signupId: string
) => {
  const customId = `cwl_roster_${action}:${signupId}:${clanTag}`;
  if ([...customId].length > 100) {
    throw new Error("The CWL signup identifier is too long for a roster button.");
  }
  return customId;
};

export const getCwlSignupId = (signup: Pick<CwlSignupRecord, "sk">) => {
  if (!signup.sk.startsWith("signup#")) {
    throw new Error("Invalid CWL signup storage key.");
  }
  return signup.sk.slice("signup#".length);
};

export const CWL_KNOWN_CLANS = [
  { name: "MiniPoint", tag: "2CYP9C9QG" },
  { name: "This Clan Now 3", tag: "2RP2LC2VY" },
  { name: "AlphaPoint", tag: "2CLL8UJR2" },
  { name: "DeltaPoint", tag: "2RR0G9L2L" },
  { name: "EcoPoint", tag: "2G2RJQ2UG" },
  { name: "SierraPoint", tag: "2J9QJ9YVJ" },
  { name: "This Clan Now 2", tag: "2GUGLVJVU" },
  { name: "ziminzi", tag: "2G0020YLY" },
];

const NON_CWL_HERO_NAMES = new Set(["battle machine", "battle copter"]);

const HERO_ABBREVIATIONS: Record<string, string> = {
  "barbarian king": "BK",
  "archer queen": "AQ",
  "grand warden": "GW",
  "royal champion": "RC",
  "minion prince": "MP",
  "dragon duke": "DD",
};

const abbreviateHero = (name: string) =>
  HERO_ABBREVIATIONS[name.toLowerCase()] ??
  name
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

const getHeroLevelSummary = (heroes: Record<string, number>) =>
  Object.entries(heroes)
    .filter(([name]) => !NON_CWL_HERO_NAMES.has(name.toLowerCase()))
    .map(([name, level]) => `${abbreviateHero(name)} ${level}`)
    .join(" • ");

export const buildCwlRosterEmbed = (
  signupName: string,
  clan: CwlSignupClan,
  townHallEmojiIds: Record<string, string>
): APIEmbed => {
  const accounts = clan.accounts ?? [];
  const roster = accounts
    .slice(0, 35)
    .map((account) => {
      const townHall = getTownHallEmoji(
        account.townHallLevel,
        townHallEmojiIds
      );
      return `${townHall.markup} <@${account.userId}> | **${account.playerName ?? account.playerTag}** | ${account.clanName ?? "Ungrouped"}`;
    })
    .join("\n");
  const leagueEmoji =
    WAR_LEAGUE[clan.league as keyof typeof WAR_LEAGUE] ?? "🏆";
  const signupOpen = clan.signupOpen !== false;

  return {
    title: `${clan.name} (#${clan.tag})`,
    url: clan.link,
    color: 0x551a8b,
    description: [
      `**${leagueEmoji} ${clan.league}**`,
      `**TOWN HALL  DISCORD  PLAYER  CLAN**`,
      roster || "_No accounts signed up yet._",
    ].join("\n"),
    footer: {
      text: `${signupName} | Role ${clan.roleId ? `<@&${clan.roleId}>` : "Not set"}\nTotal ${accounts.length}/${clan.capacity ?? 50} | Min. TH${clan.minTownHall ?? 15}\nSignup is ${signupOpen ? "open" : "closed"}`,
    },
  };
};

export const buildCwlRosterMessage = (
  signup: CwlSignupRecord,
  clan: CwlSignupClan,
  townHallEmojiIds: Record<string, string>
): RESTPostAPIWebhookWithTokenJSONBody => {
  const signupId = getCwlSignupId(signup);
  const capacity = clan.capacity ?? 50;
  const signupOpen = clan.signupOpen !== false;

  return {
    embeds: [buildCwlRosterEmbed(signup.signupName, clan, townHallEmojiIds)],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: "🔄",
            custom_id: getCwlRosterCustomId("refresh", clan.tag, signupId),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            label: "Signup",
            custom_id: getCwlRosterCustomId("signup", clan.tag, signupId),
            disabled: !signupOpen || (clan.accounts?.length ?? 0) >= capacity,
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: "Opt-out",
            custom_id: getCwlRosterCustomId("optout", clan.tag, signupId),
            disabled: (clan.accounts?.length ?? 0) === 0,
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: "⚙️",
            custom_id: `cwl_roster_dashboard:${signupId}`,
          },
        ],
      },
    ],
  };
};

export const buildLinkedAccountsEmbed = (
  accounts: CwlLinkedAccountSummary[],
  townHallEmojiIds: Record<string, string>
): APIEmbed => ({
  title: "Select an account",
  description: "Choose the linked account you want to add to this roster.",
  fields: accounts.map((account) => {
    const townHall = getTownHallEmoji(account.townHallLevel, townHallEmojiIds);
    const heroSummary = getHeroLevelSummary(account.heroes);
    return {
      name: `${townHall.markup} ${account.name} (${account.tag})`,
      value:
        [
          account.townHallLevel
            ? `Town Hall ${account.townHallLevel}`
            : undefined,
          heroSummary || undefined,
        ]
          .filter(Boolean)
          .join(" • ") || "No profile details available",
      inline: false,
    };
  }),
});

export const buildCwlDashboardMessage = (
  signup: CwlSignupRecord,
  selectedClanTag?: string
): RESTPostAPIWebhookWithTokenJSONBody => {
  const signupId = getCwlSignupId(signup);
  const selectedClan = signup.clans.find(
    (clan) => clan.tag === selectedClanTag
  );
  const existingTags = new Set(
    signup.clans.map((clan) => clan.tag.toUpperCase())
  );
  const availableClans = CWL_KNOWN_CLANS.filter(
    (clan) => !existingTags.has(clan.tag)
  );

  const fields = signup.clans.map((clan) => ({
    name: `[${clan.name} (#${clan.tag})](<${clan.link}>)`,
    value: [
      `League: **${clan.league}**`,
      `Roster: **${clan.accounts?.length ?? 0}/${clan.capacity ?? 50}**`,
      `Minimum TH: **${clan.minTownHall ?? 15}**`,
      `Role: ${clan.roleId ? `<@&${clan.roleId}>` : "Not set"}`,
      `Signup: **${clan.signupOpen === false ? "Closed" : "Open"}**`,
    ].join(" • "),
    inline: false,
  }));
  const components: NonNullable<
    RESTPostAPIWebhookWithTokenJSONBody["components"]
  > = [];

  if (availableClans.length > 0) {
    components.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          custom_id: `cwl_dashboard_add:${signupId}`,
          placeholder: "Add a clan to this signup",
          min_values: 1,
          max_values: 1,
          options: availableClans.map((clan) => ({
            label: `${clan.name} (#${clan.tag})`,
            value: clan.tag,
          })),
        },
      ],
    });
  }
  if (signup.clans.length > 0) {
    components.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          custom_id: `cwl_dashboard_select:${signupId}`,
          placeholder: "Select a clan to edit",
          min_values: 1,
          max_values: 1,
          options: signup.clans.slice(0, 25).map((clan) => ({
            label: `${clan.name} (#${clan.tag})`.slice(0, 100),
            value: clan.tag,
          })),
        },
      ],
    });
  }
  components.push({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Success,
        label: "Add clan by tag",
        custom_id: `cwl_dashboard_add_tag:${signupId}`,
      },
    ],
  });
  components.push({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: "Rename signup",
        custom_id: `cwl_dashboard_rename:${signupId}`,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: "Edit clan",
        custom_id: `cwl_dashboard_edit:${signupId}:${selectedClanTag ?? ""}`,
        disabled: !selectedClan,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Remove clan",
        custom_id: `cwl_dashboard_remove:${signupId}:${selectedClanTag ?? ""}`,
        disabled: !selectedClan,
      },
      {
        type: ComponentType.Button,
        style:
          selectedClan?.signupOpen === false
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        label: selectedClan?.signupOpen === false ? "Open signup" : "Close signup",
        custom_id: `cwl_dashboard_toggle:${signupId}:${selectedClanTag ?? ""}`,
        disabled: !selectedClan,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: "Refresh",
        custom_id: `cwl_dashboard_refresh:${signupId}:${selectedClanTag ?? ""}`,
      },
    ],
  });
  components.push({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Success,
        label: "Add linked player",
        custom_id: `cwl_dashboard_add_player:${signupId}:${selectedClanTag ?? ""}`,
        disabled: !selectedClan,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Remove player",
        custom_id: `cwl_dashboard_remove_player:${signupId}:${selectedClanTag ?? ""}`,
        disabled: !selectedClan || (selectedClan.accounts?.length ?? 0) === 0,
      },
    ],
  });
  return {
    embeds: [
      {
        title: `CWL Dashboard - ${signup.signupName}`,
        description:
          fields.length > 0
            ? `Manage clans for this ${signup.status === "open" ? "active" : "draft"} signup.`
            : "No clans have been added to this signup yet.",
        fields,
      },
    ],
    components,
  };
};

export const buildCwlSignupEmbed = (
  signup: CwlSignupEmbedData
): APIEmbed => ({
  title: signup.signupName,
  description: signup.accounts
    .slice(-40)
    .map(
      (account) => `\`emoji\` \`${account.username}\` \`${account.playerTag}\``
    )
    .join("\n"),
  fields: (signup.clans ?? []).map((clan) => ({
    name: `[${clan.name}](<${clan.link}>)`,
    value: `**League:** ${clan.league}`,
    inline: true,
  })),
  footer: {
    text: `Total accounts: ${signup.accounts.length}\nSignup is OPEN`,
  },
});
