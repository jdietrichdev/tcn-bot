import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ClanCastleTroopInputError,
  formatClanCastleTroops,
  groupClanCastleTroops,
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

  it("groups super troops separately", () => {
    const troops = [
      { slug: "baby_dragon", quantity: 1 },
      { slug: "ice_hound", quantity: 2 },
    ];

    expect(groupClanCastleTroops(troops)).toEqual({
      troops: [{ slug: "baby_dragon", quantity: 1 }],
      superTroops: [{ slug: "ice_hound", quantity: 2 }],
    });
  });
});

describe("formatClanCastleTroops", () => {
  it("renders inline emoji rows with counts and separate troop groups", () => {
    expect(
      formatClanCastleTroops(
        [
          { slug: "baby_dragon", quantity: 1 },
          { slug: "ice_hound", quantity: 2 },
        ],
        { baby_dragon: "1001", ice_hound: "1002" }
      )
    ).toBe(
      [
        "**Troops**",
        "<:cc_baby_dragon:1001> `x1` Baby Dragon",
        "",
        "**Super Troops**",
        "<:cc_ice_hound:1002> `x2` Ice Hound",
      ].join("\n")
    );
  });

  it("requires an emoji mapping for every listed troop", () => {
    expect(() =>
      formatClanCastleTroops(
        [{ slug: "ice_golem", quantity: 2 }],
        {}
      )
    ).toThrow("Missing ClashKing application emoji for ice_golem.");
  });
});
