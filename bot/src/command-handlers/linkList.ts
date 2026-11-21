import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APIMessageComponentInteraction,
  ComponentType,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { getClan } from "../adapters/coc-api-adapter";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { ClanConfig, getConfig } from "../util/serverConfig";

type TaggedClan = ClanConfig & { tag: string };
type ClanMember = { name: string; tag: string };

const configuredClans = (guildId: string): TaggedClan[] =>
  Object.values(getConfig(guildId).CLANS).filter(
    (clan): clan is TaggedClan => Boolean(clan.tag)
  );

const escapeName = (name: string) =>
  name.slice(0, 24).replace(/[\\`*_~|>[\]]/g, "\\$&");

const isClanMember = (member: unknown): member is ClanMember =>
  typeof member === "object" && member !== null &&
  "name" in member && typeof member.name === "string" &&
  "tag" in member && typeof member.tag === "string" &&
  /^#[A-Z0-9]{1,15}$/.test(member.tag);

const findLinks = async (members: ClanMember[]): Promise<Map<string, string>> => {
  const memberTags = new Set(members.map((member) => member.tag.slice(1)));
  const links = new Map<string, string>();
  if (!memberTags.size) return links;
  // Existing link keys preserve user-entered casing, so exact index queries can miss links.
  let startKey: Record<string, unknown> | undefined;
  do {
    const result = await dynamoDbClient.send(
      new ScanCommand({
        TableName: "BotTable",
        ConsistentRead: true,
        FilterExpression: "begins_with(sk, :prefix)",
        ProjectionExpression: "pk, sk",
        ExpressionAttributeValues: { ":prefix": "player#" },
        ExclusiveStartKey: startKey,
      })
    );
    for (const link of result.Items ?? []) {
      if (typeof link.sk !== "string") {
        throw new Error("Invalid player link sort key");
      }
      const tag = link.sk.slice("player#".length).toUpperCase();
      if (!memberTags.has(tag)) continue;
      if (typeof link.pk !== "string" || !/^\d{1,20}$/.test(link.pk)) {
        throw new Error(`Invalid link record for player #${tag}`);
      }
      links.set(tag, link.pk);
    }
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return links;
};

const buildLinkList = async (
  clans: TaggedClan[],
  selected: TaggedClan
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
  const clan: unknown = await getClan(selected.tag);
  if (typeof clan !== "object" || clan === null || !("memberList" in clan)) {
    throw new Error(`Missing member list for clan ${selected.tag}`);
  }
  const members = clan.memberList;
  if (!Array.isArray(members) || members.length > 50 || !members.every(isClanMember)) {
    throw new Error(`Invalid member data for clan ${selected.tag}`);
  }
  const links = await findLinks(members);
  const linked: string[] = [];
  const unlinked: string[] = [];
  members.forEach((member) => {
    const player = `${escapeName(member.name)} (\`${member.tag}\`)`;
    const userId = links.get(member.tag.slice(1));
    if (userId) {
      linked.push(`✅ ${player} — <@${userId}>`);
    } else {
      unlinked.push(`❌ ${player}`);
    }
  });

  const lines = [
    `**Linked to the bot: ${linked.length}**`,
    ...(linked.length ? linked : ["None"]),
    "",
    `**Not linked: ${unlinked.length}**`,
    ...(unlinked.length ? unlinked : ["None"]),
  ];
  const descriptions = [""];
  for (const line of lines) {
    const last = descriptions.length - 1;
    if (descriptions[last].length + line.length + 1 > 4000) {
      descriptions.push(line);
    } else {
      descriptions[last] += `${descriptions[last] ? "\n" : ""}${line}`;
    }
  }
  const embeds: APIEmbed[] = descriptions.map((description, index) => ({
    title: index === 0 ? `${selected.name} (${selected.tag})` : undefined,
    description,
    color: 0x5865f2,
  }));
  return {
    content: "",
    embeds,
    components: [{
      type: ComponentType.ActionRow,
      components: [{
        type: ComponentType.StringSelect,
        custom_id: "link_list_clan",
        placeholder: "Select a clan",
        options: clans.map((clan) => ({
          label: `${clan.name} (${clan.tag})`,
          value: clan.tag,
          default: clan.tag === selected.tag,
        })),
      }],
    }],
    allowed_mentions: { parse: [] },
  };
};

export const handleLinkList = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  if (!interaction.guild_id) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This command can only be used in a server.",
    });
    return;
  }
  const clans = configuredClans(interaction.guild_id);
  if (!clans.length) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "No clan tags are configured for this server.",
    });
    return;
  }
  await updateResponse(
    interaction.application_id,
    interaction.token,
    await buildLinkList(clans, clans[0])
  );
};

export const handleLinkListSelect = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    if (!interaction.guild_id || interaction.data.component_type !== ComponentType.StringSelect) {
      throw new Error("Invalid link-list selection");
    }
    const selectedTag = interaction.data.values[0];
    const clans = configuredClans(interaction.guild_id);
    const selected = clans.find((clan) => clan.tag === selectedTag);
    if (!selected) {
      throw new Error("Selected clan is not configured for this server");
    }
    await updateResponse(
      interaction.application_id,
      interaction.token,
      await buildLinkList(clans, selected)
    );
  } catch (error) {
    console.error("Failed to update link list", error);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Could not update the link list. Please try again.",
    });
  }
};
