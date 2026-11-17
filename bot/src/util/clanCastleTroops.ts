import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

export interface ClanCastleTroop {
  slug: string;
  quantity: number;
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
const ICON_SIZE = 96;
const ITEMS_PER_ROW = 6;
const PADDING = 16;
const ITEM_GAP = 12;
const LABEL_ICON_GAP = 10;
const LABEL_SCALE = 6;
const LABEL_HEIGHT = 5 * LABEL_SCALE;
const BACKGROUND = { red: 250, green: 247, blue: 252 };
const FOREGROUND = { red: 85, green: 26, blue: 139 };

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  x: ["101", "101", "010", "101", "101"],
};

const TROOP_INPUT_HINT =
  'Use a quantity before each troop, for example "2x Ice Golem, 1x Baby Dragon".';

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

  const icons = troops.map((troop) => {
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

    return icon;
  });
  const labelWidths = troops.map(
    ({ quantity }) => (String(quantity).length * 4 - 1) * LABEL_SCALE
  );
  const itemWidths = labelWidths.map(
    (width) => PADDING + width + LABEL_ICON_GAP + ICON_SIZE + PADDING
  );
  const rowWidths: number[] = [];
  for (let start = 0; start < troops.length; start += ITEMS_PER_ROW) {
    const rowItems = itemWidths.slice(start, start + ITEMS_PER_ROW);
    rowWidths.push(
      rowItems.reduce((sum, width) => sum + width, 0) +
        ITEM_GAP * (rowItems.length - 1)
    );
  }

  const rowCount = Math.ceil(troops.length / ITEMS_PER_ROW);
  const rowHeight = ICON_SIZE + PADDING;
  const output = new PNG({
    width: Math.max(...rowWidths),
    height: PADDING + rowCount * rowHeight,
  });

  for (let pixel = 0; pixel < output.data.length; pixel += 4) {
    output.data[pixel] = BACKGROUND.red;
    output.data[pixel + 1] = BACKGROUND.green;
    output.data[pixel + 2] = BACKGROUND.blue;
    output.data[pixel + 3] = 255;
  }

  let x = 0;
  for (let index = 0; index < troops.length; index += 1) {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const column = index % ITEMS_PER_ROW;
    if (column === 0) {
      x = 0;
    }

    const y = PADDING + row * rowHeight;
    const text = `${troops[index].quantity}x`;
    const labelWidth = labelWidths[index];
    drawQuantity(output, text, x + PADDING, y + (ICON_SIZE - LABEL_HEIGHT) / 2);
    compositeIcon(
      output,
      icons[index],
      x + PADDING + labelWidth + LABEL_ICON_GAP,
      y
    );
    x += itemWidths[index] + ITEM_GAP;
  }

  return PNG.sync.write(output);
};

const drawQuantity = (
  output: PNG,
  text: string,
  left: number,
  top: number
) => {
  let cursorX = left;
  for (const character of text.toLowerCase()) {
    const glyph = GLYPHS[character];
    if (!glyph) {
      throw new Error(`Unsupported quantity label character: ${character}`);
    }

    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }
        for (let dy = 0; dy < LABEL_SCALE; dy += 1) {
          for (let dx = 0; dx < LABEL_SCALE; dx += 1) {
            setPixel(
              output,
              cursorX + column * LABEL_SCALE + dx,
              top + row * LABEL_SCALE + dy,
              FOREGROUND
            );
          }
        }
      }
    }
    cursorX += 4 * LABEL_SCALE;
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
