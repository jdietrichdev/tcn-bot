import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ClanCastleTroop {
  slug: string;
  quantity: number;
}

export interface ClanCastleTroopGroups {
  troops: ClanCastleTroop[];
  superTroops: ClanCastleTroop[];
}

export class ClanCastleTroopInputError extends Error {}

const getDefaultTroopIconDirectory = () => {
  const candidates = [
    path.join(process.cwd(), "clashking-troops"),
    path.join(process.cwd(), "dist", "clashking-troops"),
  ];
  return candidates.find(existsSync) ?? candidates[0];
};

const TROOP_ICON_DIRECTORY = getDefaultTroopIconDirectory();
const TROOP_EMOJI_MAP_FILENAME = "clashking-troop-emojis.json";

const SUPER_TROOP_SLUGS = new Set([
  "ice_hound",
  "inferno_dragon",
  "rocket_balloon",
  "sneaky_goblin",
  "super_archer",
  "super_barbarian",
  "super_bowler",
  "super_dragon",
  "super_giant",
  "super_hog_rider",
  "super_minion",
  "super_miner",
  "super_valkyrie",
  "super_wall_breaker",
  "super_witch",
  "super_wizard",
  "super_yeti",
]);

const TROOP_INPUT_HINT =
  'Use a quantity before each troop, for example "2x Ice Golem, 1x Baby Dragon".';

export const groupClanCastleTroops = (
  troops: ClanCastleTroop[]
): ClanCastleTroopGroups => ({
  troops: troops.filter(({ slug }) => !SUPER_TROOP_SLUGS.has(slug)),
  superTroops: troops.filter(({ slug }) => SUPER_TROOP_SLUGS.has(slug)),
});

export const getClanCastleTroopName = (slug: string) =>
  slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatClanCastleTroops = (
  troops: ClanCastleTroop[],
  emojiIds: Record<string, string>
): string => {
  const groups = groupClanCastleTroops(troops);
  const sections = [
    { title: "Troops", troops: groups.troops },
    { title: "Super Troops", troops: groups.superTroops },
  ].filter((section) => section.troops.length);

  return sections
    .map(({ title, troops: sectionTroops }) => {
      const entries = sectionTroops.map(({ slug, quantity }) => {
        const emojiId = emojiIds[slug];
        if (!emojiId) {
          throw new Error(`Missing ClashKing application emoji for ${slug}.`);
        }

        return `<:cc_${slug}:${emojiId}> \`x${quantity}\` ${getClanCastleTroopName(slug)}`;
      });

      return `**${title}**\n${entries.join("\n")}`;
    })
    .join("\n\n");
};

export const loadClanCastleTroopEmojiMap = (): Record<string, string> => {
  const candidates = [
    path.join(process.cwd(), TROOP_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "dist", TROOP_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "bot", "dist", TROOP_EMOJI_MAP_FILENAME),
  ];
  const mapPath = candidates.find(existsSync);
  if (!mapPath) {
    throw new Error(
      `Missing ${TROOP_EMOJI_MAP_FILENAME}; sync the ClashKing application emojis before deployment.`
    );
  }

  const parsed: unknown = JSON.parse(readFileSync(mapPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ClashKing application emoji map is invalid.");
  }

  const emojiIds: Record<string, string> = {};
  for (const [slug, emojiId] of Object.entries(parsed)) {
    if (
      !/^[a-z0-9_]+$/.test(slug) ||
      typeof emojiId !== "string" ||
      !/^\d+$/.test(emojiId)
    ) {
      throw new Error("ClashKing application emoji map contains an invalid entry.");
    }
    emojiIds[slug] = emojiId;
  }
  return emojiIds;
};

export const parseClanCastleTroops = (
  input: string,
  iconDirectory = TROOP_ICON_DIRECTORY
): ClanCastleTroop[] => {
  const entries = input
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries.length) {
    throw new ClanCastleTroopInputError(
      `Add at least one Clan Castle troop. ${TROOP_INPUT_HINT}`
    );
  }

  const quantities = new Map<string, number>();
  for (const entry of entries) {
    const leadingQuantity = entry.match(
      /^(\d+)\s*(?:[x×]\s*)?(.+?)\s*$/i
    );
    const trailingQuantity = entry.match(
      /^(.+?)\s+[x×]\s*(\d+)\s*$/i
    );
    const quantityText = leadingQuantity?.[1] ?? trailingQuantity?.[2];
    const name = leadingQuantity?.[2] ?? trailingQuantity?.[1];
    const quantity = quantityText ? Number(quantityText) : 0;

    if (!name || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new ClanCastleTroopInputError(
        `Couldn't read "${entry}". ${TROOP_INPUT_HINT}`
      );
    }

    const slug = resolveTroopSlug(name, iconDirectory);
    if (!slug) {
      throw new ClanCastleTroopInputError(
        `I couldn't find a troop icon for "${name}". Check the troop name and try again.`
      );
    }

    const total = (quantities.get(slug) ?? 0) + quantity;
    if (!Number.isSafeInteger(total)) {
      throw new ClanCastleTroopInputError(
        `The quantity for "${name}" is too large.`
      );
    }
    quantities.set(slug, total);
  }

  return Array.from(quantities, ([slug, quantity]) => ({ slug, quantity }));
};

const resolveTroopSlug = (
  name: string,
  iconDirectory: string
): string | undefined => {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const candidates = [normalized];

  if (normalized.endsWith("ies")) {
    candidates.push(`${normalized.slice(0, -3)}y`);
  }
  if (normalized.endsWith("es")) {
    candidates.push(normalized.slice(0, -2));
  }
  if (normalized.endsWith("s")) {
    candidates.push(normalized.slice(0, -1));
  }

  return candidates.find((candidate) =>
    existsSync(path.join(iconDirectory, `${candidate}.png`))
  );
};
