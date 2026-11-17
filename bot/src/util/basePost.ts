import {
  APIActionRowComponent,
  APIEmbed,
  APIMessageActionRowComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  formatClanCastleTroops,
  type ClanCastleTroop,
} from "./clanCastleTroops";

export const CLAN_CASTLE_TROOP_IMAGE_FILENAME = "clan-castle-troops.png";
const BASE_POST_LEAGUE_EMOJI_MAP_FILENAME = "clashking-league-emojis.json";
const LEAGUE_EMOJI_KEY_BY_NAME: Record<string, string> = {
  "Legends 1": "legends_1",
  "Legends 2": "legends_2",
  "Legends 3": "legends_3",
  "Legends 2/3": "legends_2_3",
  CWL: "cwl",
  "Titan I CWL": "titan_1_cwl",
  "Titan II CWL": "titan_2_cwl",
  "Titan III CWL": "titan_3_cwl",
};

export interface BasePostAttachment {
  id: string;
  filename: string;
}

export interface BasePostRecord {
  guildId: string;
  channelId: string;
  messageId: string;
  baseId: number;
  baseLink: string;
  clanCastle: string;
  clanCastleTroops?: ClanCastleTroop[];
  clanCastleTroopEmojiIds?: Record<string, string>;
  clanCastleAttachment?: BasePostAttachment;
  league: string;
  leagueEmojiId?: string;
  notes?: string;
  imageUrl: string;
  builderName: string;
  downloads: number;
  positiveVotes: number;
  negativeVotes: number;
}

export const BASE_POST_BUTTONS = {
  positiveVote: "base_post_positive",
  negativeVote: "base_post_negative",
  downloadCount: "base_post_download_count",
} as const;

export interface BasePostPayload {
  embeds: APIEmbed[];
  components: APIActionRowComponent<APIMessageActionRowComponent>[];
  attachments?: BasePostAttachment[];
}

export const getRecommendedLeagueEmojiKey = (league: string): string => {
  const emojiKey = LEAGUE_EMOJI_KEY_BY_NAME[league];
  if (!emojiKey) {
    throw new Error(`No application emoji is configured for league "${league}".`);
  }
  return emojiKey;
};

export const loadBasePostLeagueEmojiMap = (): Record<string, string> => {
  const candidates = [
    path.join(process.cwd(), BASE_POST_LEAGUE_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "dist", BASE_POST_LEAGUE_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "bot", "dist", BASE_POST_LEAGUE_EMOJI_MAP_FILENAME),
  ];
  const mapPath = candidates.find(existsSync);
  if (!mapPath) {
    throw new Error(
      `Missing ${BASE_POST_LEAGUE_EMOJI_MAP_FILENAME}; sync the ClashKing application emojis before deployment.`
    );
  }

  const parsed: unknown = JSON.parse(readFileSync(mapPath, "utf8"));
  if (!isEmojiIdMap(parsed)) {
    throw new Error("ClashKing league emoji map is invalid.");
  }
  return parsed;
};

export const buildBasePostEmbed = (basePost: BasePostRecord): APIEmbed => {
  const formattedTroops =
    basePost.clanCastleTroops?.length && basePost.clanCastleTroopEmojiIds
      ? formatClanCastleTroops(
          basePost.clanCastleTroops,
          basePost.clanCastleTroopEmojiIds
        )
      : undefined;
  const leagueEmoji = basePost.leagueEmojiId
    ? `<:league_${getRecommendedLeagueEmojiKey(basePost.league)}:${basePost.leagueEmojiId}> `
    : "";
  const formattedNotes = basePost.notes
    ?.split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

  return {
    title: `<:emblem:1502439157832749057> Point Alliance Base #${basePost.baseId}`,
    description: `**Recommended League**\n> ${leagueEmoji}**${basePost.league}**`,
    color: 0x551a8b,
    fields: [
      {
        name: formattedTroops ? "Clan Castle Troops" : "Clan Castle",
        value: formattedTroops ?? basePost.clanCastle,
      },
      {
        name: "Shared by",
        value: `**${basePost.builderName}**`,
        inline: true,
      },
      ...(formattedNotes
        ? [{ name: "Builder Notes", value: formattedNotes }]
        : []),
    ],
    image: { url: basePost.imageUrl },
  };
};

export const buildBasePostEmbeds = (basePost: BasePostRecord): APIEmbed[] => [
  buildBasePostEmbed(basePost),
];

export const buildBasePostPayload = (
  basePost: BasePostRecord,
  redirectBaseUrl: string
): BasePostPayload => ({
  embeds: buildBasePostEmbeds(basePost),
  ...(basePost.clanCastleAttachment
    ? { attachments: [] }
    : {}),
  components: [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Link",
          emoji: { name: "\u{1F517}" },
          url: buildBasePostRedirectUrl(basePost, redirectBaseUrl),
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          emoji: { name: "\u{1F4C8}" },
          label: `${basePost.downloads} Download${basePost.downloads === 1 ? "" : "s"}`,
          custom_id: BASE_POST_BUTTONS.downloadCount,
          disabled: true,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          emoji: { name: "\u{2705}" },
          label: String(basePost.positiveVotes),
          custom_id: BASE_POST_BUTTONS.positiveVote,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Danger,
          emoji: { name: "\u{274C}" },
          label: String(basePost.negativeVotes),
          custom_id: BASE_POST_BUTTONS.negativeVote,
        },
      ],
    },
  ],
});

export const buildBasePostRedirectUrl = (
  basePost: Pick<BasePostRecord, "guildId" | "messageId">,
  redirectBaseUrl: string
) => {
  const baseUrl = new URL(redirectBaseUrl);
  if (baseUrl.protocol !== "https:") {
    throw new Error("Base-post redirect URL must use HTTPS.");
  }

  return `${baseUrl.toString().replace(/\/+$/, "")}/${basePost.guildId}/${basePost.messageId}`;
};

export const isBasePostRecord = (
  item: unknown
): item is BasePostRecord & Record<string, unknown> =>
  isRecord(item) &&
  typeof item.guildId === "string" &&
  typeof item.channelId === "string" &&
  typeof item.messageId === "string" &&
  typeof item.baseId === "number" &&
  typeof item.baseLink === "string" &&
  typeof item.clanCastle === "string" &&
  (item.clanCastleTroops === undefined ||
    isClanCastleTroopArray(item.clanCastleTroops)) &&
  (item.clanCastleTroopEmojiIds === undefined ||
    isClanCastleTroopEmojiIdMap(item.clanCastleTroopEmojiIds)) &&
  (item.clanCastleAttachment === undefined ||
    isBasePostAttachment(item.clanCastleAttachment)) &&
  typeof item.league === "string" &&
  (item.leagueEmojiId === undefined ||
    (typeof item.leagueEmojiId === "string" &&
      /^\d+$/.test(item.leagueEmojiId))) &&
  (item.notes === undefined || typeof item.notes === "string") &&
  typeof item.imageUrl === "string" &&
  typeof item.builderName === "string" &&
  typeof item.downloads === "number" &&
  typeof item.positiveVotes === "number" &&
  typeof item.negativeVotes === "number";

const isClanCastleTroopArray = (value: unknown): value is ClanCastleTroop[] =>
  Array.isArray(value) && value.every(isClanCastleTroop);

const isClanCastleTroop = (value: unknown): value is ClanCastleTroop =>
  isRecord(value) &&
  typeof value.slug === "string" &&
  typeof value.quantity === "number" &&
  Number.isSafeInteger(value.quantity) &&
  value.quantity > 0;

const isClanCastleTroopEmojiIdMap = (
  value: unknown
): value is Record<string, string> => isEmojiIdMap(value);

const isEmojiIdMap = (
  value: unknown
): value is Record<string, string> =>
  isRecord(value) &&
  Object.entries(value).every(
    ([slug, emojiId]) =>
      /^[a-z0-9_]+$/.test(slug) &&
      typeof emojiId === "string" &&
      /^\d+$/.test(emojiId)
  );

const isBasePostAttachment = (
  value: unknown
): value is BasePostAttachment =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.filename === CLAN_CASTLE_TROOP_IMAGE_FILENAME;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";
