import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const MAX_TOWN_HALL_LEVEL = 19;
const TOWN_HALL_EMOJI_MAP_FILENAME = "clashking-town-hall-emojis.json";

const isEmojiIdMap = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([level, emojiId]) =>
      /^[1-9]\d?$/.test(level) &&
      Number(level) <= MAX_TOWN_HALL_LEVEL &&
      typeof emojiId === "string" &&
      /^\d+$/.test(emojiId)
  );

export const loadTownHallEmojiMap = (): Record<string, string> => {
  const candidates = [
    path.join(process.cwd(), TOWN_HALL_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "dist", TOWN_HALL_EMOJI_MAP_FILENAME),
    path.join(process.cwd(), "bot", "dist", TOWN_HALL_EMOJI_MAP_FILENAME),
  ];
  const mapPath = candidates.find(existsSync);
  if (!mapPath) {
    return {};
  }

  const parsed: unknown = JSON.parse(readFileSync(mapPath, "utf8"));
  if (!isEmojiIdMap(parsed)) {
    throw new Error("ClashKing Town Hall emoji map is invalid.");
  }
  return parsed;
};

export const getTownHallEmoji = (
  level: number | undefined,
  emojiIds: Record<string, string>
) => {
  if (level === undefined) {
    return {
      markup: "🏠",
      componentEmoji: { name: "🏠" },
    };
  }
  if (!Number.isInteger(level) || level < 1 || level > MAX_TOWN_HALL_LEVEL) {
    throw new Error(`Unsupported Town Hall level: ${level}.`);
  }

  const emojiId = emojiIds[String(level)];
  if (!emojiId) {
    return {
      markup: `🏠 TH${level}`,
      componentEmoji: { name: "🏠" },
    };
  }
  const name = `town_hall_${level}`;
  return {
    markup: `<:${name}:${emojiId}>`,
    componentEmoji: { id: emojiId, name },
  };
};
