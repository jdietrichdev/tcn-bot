import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

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
const ICON_SIZE = 24;
const PADDING = 12;
const ROW_HEIGHT = 30;
const SECTION_GAP = 8;
const HEADER_GAP = 4;
const FONT_SCALE = 2;
const FONT_ADVANCE = 6;
const FONT_HEIGHT = 7 * FONT_SCALE;
const BADGE_HEIGHT = FONT_HEIGHT + 4;
const ICON_BADGE_GAP = 8;
const BADGE_NAME_GAP = 8;
const BACKGROUND = { red: 35, green: 36, blue: 40 };
const FOREGROUND = { red: 232, green: 234, blue: 237 };
const BADGE_BACKGROUND = { red: 85, green: 26, blue: 139 };

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

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
};

const TROOP_INPUT_HINT =
  'Use a quantity before each troop, for example "2x Ice Golem, 1x Baby Dragon".';

export const groupClanCastleTroops = (
  troops: ClanCastleTroop[]
): ClanCastleTroopGroups => ({
  troops: troops.filter(({ slug }) => !SUPER_TROOP_SLUGS.has(slug)),
  superTroops: troops.filter(({ slug }) => SUPER_TROOP_SLUGS.has(slug)),
});

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

export const buildClanCastleTroopGraphic = (
  troops: ClanCastleTroop[],
  iconDirectory = TROOP_ICON_DIRECTORY
): Buffer => {
  if (!troops.length) {
    throw new Error("Cannot render an empty Clan Castle troop list.");
  }

  const icons = new Map(troops.map((troop) => {
    const iconPath = path.join(iconDirectory, `${troop.slug}.png`);
    if (!existsSync(iconPath)) {
      throw new Error(`Missing Clan Castle troop icon: ${troop.slug}`);
    }

    const icon = PNG.sync.read(readFileSync(iconPath));
    if (icon.width !== ICON_SIZE || icon.height !== ICON_SIZE) {
      throw new Error(
        `Clan Castle troop icon ${troop.slug} must be ${ICON_SIZE}x${ICON_SIZE}px.`
      );
    }

    return [troop.slug, icon] as const;
  }));
  const groups = groupClanCastleTroops(troops);
  const sections = [
    { title: "Troops", troops: groups.troops },
    { title: "Super Troops", troops: groups.superTroops },
  ].filter((section) => section.troops.length);
  const sectionContentHeight = sections.reduce(
    (height, section) =>
      height + FONT_HEIGHT + HEADER_GAP + section.troops.length * ROW_HEIGHT,
    0
  );
  const rowContentWidth = troops.reduce((width, troop) => {
    const badgeWidth = measureText(`x${troop.quantity}`) + 8;
    return Math.max(
      width,
      ICON_SIZE +
        ICON_BADGE_GAP +
        badgeWidth +
        BADGE_NAME_GAP +
        measureText(getTroopName(troop.slug))
    );
  }, 0);
  const output = new PNG({
    width: Math.max(300, PADDING * 2 + rowContentWidth),
    height:
      PADDING * 2 +
      sectionContentHeight +
      Math.max(0, sections.length - 1) * SECTION_GAP,
  });

  for (let pixel = 0; pixel < output.data.length; pixel += 4) {
    output.data[pixel] = BACKGROUND.red;
    output.data[pixel + 1] = BACKGROUND.green;
    output.data[pixel + 2] = BACKGROUND.blue;
    output.data[pixel + 3] = 255;
  }

  let sectionTop = PADDING;
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      sectionTop += SECTION_GAP;
    }
    drawText(output, section.title, PADDING, sectionTop, FOREGROUND);
    let rowTop = sectionTop + FONT_HEIGHT + HEADER_GAP;

    section.troops.forEach((troop) => {
      const icon = icons.get(troop.slug);
      if (!icon) {
        throw new Error(`Missing rendered Clan Castle troop icon: ${troop.slug}`);
      }

      const iconTop = rowTop + Math.floor((ROW_HEIGHT - ICON_SIZE) / 2);
      compositeIcon(output, icon, PADDING, iconTop);

      const quantityLabel = `x${troop.quantity}`;
      const badgeWidth = measureText(quantityLabel) + 8;
      const badgeLeft = PADDING + ICON_SIZE + ICON_BADGE_GAP;
      const badgeTop = rowTop + Math.floor((ROW_HEIGHT - BADGE_HEIGHT) / 2);
      fillRectangle(
        output,
        badgeLeft,
        badgeTop,
        badgeWidth,
        BADGE_HEIGHT,
        BADGE_BACKGROUND
      );
      drawText(
        output,
        quantityLabel,
        badgeLeft + 4,
        badgeTop + 2,
        FOREGROUND
      );

      drawText(
        output,
        getTroopName(troop.slug),
        badgeLeft + badgeWidth + BADGE_NAME_GAP,
        rowTop + Math.floor((ROW_HEIGHT - FONT_HEIGHT) / 2),
        FOREGROUND
      );
      rowTop += ROW_HEIGHT;
    });

    sectionTop = rowTop;
  });

  return PNG.sync.write(output);
};

const getTroopName = (slug: string) =>
  slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const measureText = (text: string) =>
  text.length
    ? (text.length * FONT_ADVANCE - 1) * FONT_SCALE
    : 0;

const drawText = (
  output: PNG,
  text: string,
  left: number,
  top: number,
  color: { red: number; green: number; blue: number }
) => {
  let cursorX = left;
  for (const character of text.toUpperCase()) {
    const glyph = GLYPHS[character];
    if (!glyph) {
      throw new Error(`Unsupported troop graphic character: ${character}`);
    }

    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }
        for (let dy = 0; dy < FONT_SCALE; dy += 1) {
          for (let dx = 0; dx < FONT_SCALE; dx += 1) {
            setPixel(
              output,
              cursorX + column * FONT_SCALE + dx,
              top + row * FONT_SCALE + dy,
              color
            );
          }
        }
      }
    }
    cursorX += FONT_ADVANCE * FONT_SCALE;
  }
};

const fillRectangle = (
  output: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  color: { red: number; green: number; blue: number }
) => {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      setPixel(output, x, y, color);
    }
  }
};

const compositeIcon = (
  output: PNG,
  icon: PNG,
  left: number,
  top: number
) => {
  for (let y = 0; y < icon.height; y += 1) {
    for (let x = 0; x < icon.width; x += 1) {
      const sourceIndex = (y * icon.width + x) * 4;
      const alpha = icon.data[sourceIndex + 3] / 255;
      if (alpha === 0) {
        continue;
      }

      const targetIndex = ((top + y) * output.width + left + x) * 4;
      output.data[targetIndex] = Math.round(
        icon.data[sourceIndex] * alpha +
          output.data[targetIndex] * (1 - alpha)
      );
      output.data[targetIndex + 1] = Math.round(
        icon.data[sourceIndex + 1] * alpha +
          output.data[targetIndex + 1] * (1 - alpha)
      );
      output.data[targetIndex + 2] = Math.round(
        icon.data[sourceIndex + 2] * alpha +
          output.data[targetIndex + 2] * (1 - alpha)
      );
    }
  }
};

const setPixel = (
  image: PNG,
  x: number,
  y: number,
  color: { red: number; green: number; blue: number }
) => {
  const index = (y * image.width + x) * 4;
  image.data[index] = color.red;
  image.data[index + 1] = color.green;
  image.data[index + 2] = color.blue;
  image.data[index + 3] = 255;
};
