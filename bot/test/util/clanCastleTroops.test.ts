import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import {
  buildClanCastleTroopGraphic,
  ClanCastleTroopInputError,
  parseClanCastleTroops,
} from "../../src/util/clanCastleTroops";

describe("parseClanCastleTroops", () => {
  let iconDirectory: string;

  beforeEach(() => {
    iconDirectory = mkdtempSync(
      path.join(os.tmpdir(), "clan-castle-troops-")
    );
    for (const slug of ["ice_golem", "baby_dragon"]) {
      writeFileSync(path.join(iconDirectory, `${slug}.png`), "");
    }
  });

  afterEach(() => {
    rmSync(iconDirectory, { recursive: true, force: true });
  });

  it("parses counts and combines duplicate troop names", () => {
    expect(
      parseClanCastleTroops(
        "2x Ice Golem, 1 Baby Dragon; Ice Golems x 1",
        iconDirectory
      )
    ).toEqual([
      { slug: "ice_golem", quantity: 3 },
      { slug: "baby_dragon", quantity: 1 },
    ]);
  });

  it("rejects missing quantities and troop names without icons", () => {
    expect(() =>
      parseClanCastleTroops("Ice Golem", iconDirectory)
    ).toThrow(ClanCastleTroopInputError);
    expect(() =>
      parseClanCastleTroops("1x Unknown Troop", iconDirectory)
    ).toThrow(/couldn't find a troop icon/i);
  });
});

describe("buildClanCastleTroopGraphic", () => {
  let iconDirectory: string;

  beforeEach(() => {
    iconDirectory = mkdtempSync(
      path.join(os.tmpdir(), "clan-castle-graphic-")
    );
    for (const [slug, color] of [
      ["ice_golem", { red: 220, green: 40, blue: 40 }],
      ["baby_dragon", { red: 40, green: 80, blue: 220 }],
    ] as const) {
      const icon = new PNG({ width: 96, height: 96 });
      for (let index = 0; index < icon.data.length; index += 4) {
        icon.data[index] = color.red;
        icon.data[index + 1] = color.green;
        icon.data[index + 2] = color.blue;
        icon.data[index + 3] = 255;
      }
      mkdirSync(iconDirectory, { recursive: true });
      writeFileSync(
        path.join(iconDirectory, `${slug}.png`),
        PNG.sync.write(icon)
      );
    }
  });

  afterEach(() => {
    rmSync(iconDirectory, { recursive: true, force: true });
  });

  it("creates a PNG containing each requested troop icon", () => {
    const result = buildClanCastleTroopGraphic(
      [
        { slug: "ice_golem", quantity: 2 },
        { slug: "baby_dragon", quantity: 1 },
      ],
      iconDirectory
    );
    const graphic = PNG.sync.read(result);
    let redPixels = 0;
    let bluePixels = 0;

    for (let index = 0; index < graphic.data.length; index += 4) {
      if (graphic.data[index] > 180 && graphic.data[index + 1] < 80) {
        redPixels += 1;
      }
      if (graphic.data[index + 2] > 180 && graphic.data[index] < 80) {
        bluePixels += 1;
      }
    }

    expect(graphic.width).toBeGreaterThan(96);
    expect(graphic.height).toBe(128);
    expect(redPixels).toBeGreaterThan(0);
    expect(bluePixels).toBeGreaterThan(0);
  });
});
