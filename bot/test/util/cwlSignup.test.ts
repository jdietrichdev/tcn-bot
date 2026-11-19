import {
  buildCwlDashboardMessage,
  buildCwlRosterMessage,
  buildCwlSignupEmbed,
  buildLinkedAccountsEmbed,
  CwlSignupClan,
  CwlSignupRecord,
} from "../../src/util/cwlSignup";
import { getTownHallEmoji } from "../../src/util/townHallEmoji";

const signup: CwlSignupRecord = {
  pk: "guild",
  sk: "signup#november",
  signupName: "November CWL",
  status: "draft",
  clans: [],
};

describe("CWL signup embeds", () => {
  it("formats Town Hall application emojis for embeds and select menus", () => {
    expect(
      getTownHallEmoji(19, { "19": "123456789012345678" })
    ).toEqual({
      markup: "<:town_hall_19:123456789012345678>",
      componentEmoji: {
        id: "123456789012345678",
        name: "town_hall_19",
      },
    });
    expect(getTownHallEmoji(undefined, {})).toEqual({
      markup: "🏠",
      componentEmoji: { name: "🏠" },
    });
    expect(getTownHallEmoji(16, {})).toEqual({
      markup: "🏠 TH16",
      componentEmoji: { name: "🏠" },
    });
  });

  it("includes clickable clan links and leagues alongside signup accounts", () => {
    const embed = buildCwlSignupEmbed({
      signupName: "November CWL",
      accounts: [{ username: "Player", playerTag: "#ABC123" }],
      clans: [
        {
          name: "MiniPoint",
          tag: "2CYP9C9QG",
          league: "Master League I",
          link: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG",
        },
      ],
    });

    expect(embed.title).toBe("November CWL");
    expect(embed.description).toContain("`Player` `#ABC123`");
    expect(embed.fields).toEqual([
      {
        name: "[MiniPoint](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG>)",
        value: "**League:** Master League I",
        inline: true,
      },
    ]);
  });

  it("builds a clan roster with capacity, signup controls, and a stable signup ID", () => {
    const clan: CwlSignupClan = {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG",
      accounts: [
        {
          userId: "123",
          playerTag: "#PLAYER1",
          playerName: "Player One",
          clanName: "Current Clan",
          townHallLevel: 16,
          heroes: { "Battle Machine": 99 },
        },
      ],
      capacity: 30,
      minTownHall: 15,
    };

    const message = buildCwlRosterMessage(
      { ...signup, clans: [clan] },
      clan,
      { "16": "123456789012345678" }
    );

    const embed = message.embeds?.[0];
    expect(embed?.title).toBe("MiniPoint (#2CYP9C9QG)");
    expect(embed?.url).toBe(clan.link);
    expect(embed?.description).toContain(
      "<:town_hall_16:123456789012345678> <@123> | **Player One** | Current Clan"
    );
    expect(embed?.description).not.toContain("Battle Machine");
    expect(embed?.description).not.toContain("99");
    expect(embed?.footer?.text).toContain("Total 1/30");
    const actionRow = message.components?.[0];
    if (!actionRow || !("components" in actionRow)) {
      throw new Error("Expected an action row with roster controls.");
    }
    expect(actionRow.components[1]).toMatchObject({
      label: "Signup",
      custom_id: "cwl_roster_signup:november:2CYP9C9QG",
    });
  });

  it("uses Town Hall emojis for account summaries without hero levels", () => {
    const embed = buildLinkedAccountsEmbed(
      [
        {
          tag: "#PLAYER1",
          name: "Player One",
          townHallLevel: 16,
          heroes: {
            "Barbarian King": 90,
            "Archer Queen": 90,
            "Battle Machine": 35,
            "Battle Copter": 35,
          },
        },
      ],
      { "16": "123456789012345678" }
    );

    expect(embed.fields?.[0]?.name).toBe(
      "<:town_hall_16:123456789012345678> Player One (#PLAYER1)"
    );
    expect(embed.fields?.[0]?.value).toBe(
      "Town Hall 16 • Barbarian King 90 • Archer Queen 90"
    );
    expect(embed.fields?.[0]?.value).not.toContain("🦸");
    expect(embed.fields?.[0]?.value).not.toContain("Battle Machine");
    expect(embed.fields?.[0]?.value).not.toContain("Battle Copter");
  });

  it("builds dashboard clan choices and disables signup management without a selected clan", () => {
    const clan: CwlSignupClan = {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG",
      accounts: [],
    };
    const message = buildCwlDashboardMessage({
      ...signup,
      clans: [clan],
    });

    expect(message.embeds?.[0]?.title).toBe("CWL Dashboard - November CWL");
    const selectRow = message.components?.[1];
    if (!selectRow || !("components" in selectRow)) {
      throw new Error("Expected a clan selection menu.");
    }
    expect(selectRow.components[0]).toMatchObject({
      type: 3,
      custom_id: "cwl_dashboard_select:november",
    });
    const actionRow = message.components?.[3];
    if (!actionRow || !("components" in actionRow)) {
      throw new Error("Expected dashboard action buttons.");
    }
    expect(actionRow.components[1]).toMatchObject({ disabled: true });
    expect(actionRow.components[2]).toMatchObject({ disabled: true });
    expect(actionRow.components[3]).toMatchObject({ disabled: true });
    const playerRow = message.components?.[4];
    if (!playerRow || !("components" in playerRow)) {
      throw new Error("Expected admin player controls.");
    }
    expect(playerRow.components[0]).toMatchObject({
      label: "Add linked player",
      disabled: true,
    });
    expect(playerRow.components[1]).toMatchObject({
      label: "Remove player",
      disabled: true,
    });
  });
});
