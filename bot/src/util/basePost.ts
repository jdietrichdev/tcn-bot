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
  link: "base_post_link",
  positiveVote: "base_post_positive",
  negativeVote: "base_post_negative",
} as const;

export interface BasePostPayload {
  embeds: APIEmbed[];
  components: APIActionRowComponent<APIMessageActionRowComponent>[];
}

export const buildBasePostEmbed = (basePost: BasePostRecord): APIEmbed => ({
  title: "Clash of Clans Base",
  description: [
    `Shared by **${basePost.builderName}**`,
    `📥 **${basePost.downloads} download${basePost.downloads === 1 ? "" : "s"}**`,
  ].join("\n\n"),
  color: 0x5865f2,
  fields: [
    { name: "Clan Castle", value: basePost.clanCastle, inline: true },
    { name: "Recommended League", value: basePost.league, inline: true },
    ...(basePost.notes
      ? [{ name: "Builder Notes", value: basePost.notes }]
      : []),
  ],
  image: { url: basePost.imageUrl },
});

export const buildBasePostPayload = (
  basePost: BasePostRecord
): BasePostPayload => ({
  embeds: [buildBasePostEmbed(basePost)],
  components: [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "Link",
          emoji: { name: "🔗" },
          custom_id: BASE_POST_BUTTONS.link,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          emoji: { name: "✅" },
          label: String(basePost.positiveVotes),
          custom_id: BASE_POST_BUTTONS.positiveVote,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Danger,
          emoji: { name: "❌" },
          label: String(basePost.negativeVotes),
          custom_id: BASE_POST_BUTTONS.negativeVote,
        },
      ],
    },
  ],
});

export const isBasePostRecord = (
  item: Record<string, unknown> | undefined
): item is BasePostRecord =>
  !!item &&
  typeof item.guildId === "string" &&
  typeof item.channelId === "string" &&
  typeof item.messageId === "string" &&
  typeof item.baseLink === "string" &&
  typeof item.clanCastle === "string" &&
  typeof item.league === "string" &&
  (item.notes === undefined || typeof item.notes === "string") &&
  typeof item.imageUrl === "string" &&
  typeof item.builderName === "string" &&
  typeof item.downloads === "number" &&
  typeof item.positiveVotes === "number" &&
  typeof item.negativeVotes === "number";
