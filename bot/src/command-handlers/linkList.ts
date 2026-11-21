import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
class LinkIndexNotReadyError extends Error {}

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
  const migration = await dynamoDbClient.send(new GetCommand({
    TableName: "BotTable",
    Key: { pk: "system#link-index", sk: "migration" },
    ConsistentRead: true,
  }));
  if (migration.Item?.status !== "complete") {
    throw new LinkIndexNotReadyError("Player link index migration has not completed");
  }
  const tags = [...memberTags];
  for (let index = 0; index < tags.length; index++) {
    const tag = tags[index];
    const result = await dynamoDbClient.send(new QueryCommand({
      TableName: "BotTable",
      IndexName: "normalized-player-tag-index",
      KeyConditionExpression: "normalizedPlayerTag = :tag",
      ExpressionAttributeValues: { ":tag": `player#${tag}` },
      Limit: 1,
    }));
    const link = result.Items?.[0];
    if (link) {
      if (typeof link.pk !== "string" || !/^\d{1,20}$/.test(link.pk)) {
        throw new Error(`Invalid link record for player #${tag}`);
      }
      links.set(tag, link.pk);
    }
    // Keep individual index reads below the default provisioned capacity.
    if (index < tags.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
  }
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
  try {
    await updateResponse(
      interaction.application_id,
      interaction.token,
      await buildLinkList(clans, clans[0])
    );
  } catch (error) {
    if (!(error instanceof LinkIndexNotReadyError)) throw error;
    await updateResponse(interaction.application_id, interaction.token, {
      content: "The player link index is not ready. An administrator must complete the link index migration.",
    });
  }
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
      content: error instanceof LinkIndexNotReadyError
        ? "The player link index is not ready. An administrator must complete the link index migration."
        : "Could not update the link list. Please try again.",
    });
  }
};
