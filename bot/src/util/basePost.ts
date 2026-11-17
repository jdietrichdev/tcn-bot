import {
  APIActionRowComponent,
  APIEmbed,
  APIMessageActionRowComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";

export interface BasePostRecord {
  guildId: string;
  channelId: string;
  messageId: string;
  baseId: number;
  baseLink: string;
  clanCastle: string;
  league: string;
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
}

export const buildBasePostEmbed = (basePost: BasePostRecord): APIEmbed => ({
  title: `<:emblem:1502439157832749057> Point Alliance Base #${basePost.baseId}`,
  description: `**Recommended League:** ${basePost.league}`,
  color: 0x551a8b,
  fields: [
    { name: "Clan Castle", value: basePost.clanCastle, inline: true },
    { name: "Shared by", value: basePost.builderName, inline: true },
    ...(basePost.notes
      ? [{ name: "Builder Notes", value: basePost.notes }]
      : []),
  ],
  image: { url: basePost.imageUrl },
});

export const buildBasePostPayload = (
  basePost: BasePostRecord,
  redirectBaseUrl: string
): BasePostPayload => ({
  embeds: [buildBasePostEmbed(basePost)],
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
  item: Record<string, unknown> | undefined
): item is BasePostRecord & Record<string, unknown> =>
  !!item &&
  typeof item.guildId === "string" &&
  typeof item.channelId === "string" &&
  typeof item.messageId === "string" &&
  typeof item.baseId === "number" &&
  typeof item.baseLink === "string" &&
  typeof item.clanCastle === "string" &&
  typeof item.league === "string" &&
  (item.notes === undefined || typeof item.notes === "string") &&
  typeof item.imageUrl === "string" &&
  typeof item.builderName === "string" &&
  typeof item.downloads === "number" &&
  typeof item.positiveVotes === "number" &&
  typeof item.negativeVotes === "number";
