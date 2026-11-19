import {
  APIEmbed,
  ButtonStyle,
  ComponentType,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";

export interface CwlSignupClan {
  name: string;
  tag: string;
  league: string;
  link: string;
  accounts?: CwlRosterAccount[];
  messageId?: string;
}

export interface CwlRosterAccount {
  userId: string;
  playerTag: string;
}

export interface CwlSignupRecord {
  pk: string;
  sk: string;
  signupName: string;
  clans: CwlSignupClan[];
  channelId?: string;
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
  typeof value.playerTag === "string";

export const isCwlSignupClan = (value: unknown): value is CwlSignupClan =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.tag === "string" &&
  typeof value.league === "string" &&
  typeof value.link === "string" &&
  (value.messageId === undefined || typeof value.messageId === "string") &&
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
  (value.status === undefined ||
    value.status === "draft" ||
    value.status === "open");

export const getCwlRosterCustomId = (
  action: "signup" | "account",
  clanTag: string,
  signupName: string
) => {
  const customId = `cwl_roster_${action}:${clanTag}:${signupName}`;
  if ([...customId].length > 100) {
    throw new Error("The CWL signup name is too long for a roster button.");
  }
  return customId;
};

export const buildCwlRosterEmbed = (
  signupName: string,
  clan: CwlSignupClan
): APIEmbed => {
  const accounts = clan.accounts ?? [];
  const roster = accounts
    .slice(-35)
    .map((account) => `<@${account.userId}> | \`${account.playerTag}\``)
    .join("\n");

  return {
    title: `${clan.name} CWL Roster`,
    url: clan.link,
    description: [
      `**Signup:** ${signupName}`,
      `**League:** ${clan.league}`,
      `[Open clan profile](<${clan.link}>)`,
      "",
      `**Roster (${accounts.length})**`,
      roster || "_No accounts signed up yet._",
    ].join("\n"),
    footer: {
      text: "Click the button below to sign up an account",
    },
  };
};

export const buildCwlRosterMessage = (
  signupName: string,
  clan: CwlSignupClan
): RESTPostAPIWebhookWithTokenJSONBody => ({
  embeds: [buildCwlRosterEmbed(signupName, clan)],
  components: [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: `Sign up for ${clan.name}`.slice(0, 80),
          custom_id: getCwlRosterCustomId("signup", clan.tag, signupName),
        },
      ],
    },
  ],
});

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
