import {
  buildCwlRosterMessage,
  buildCwlSignupEmbed,
  CwlSignupClan,
} from "../../src/util/cwlSignup";

describe("CWL signup embed", () => {
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

  it("builds a clan-specific roster embed and signup button", () => {
    const clan: CwlSignupClan = {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2CYP9C9QG",
      accounts: [{ userId: "123", playerTag: "#PLAYER1" }],
    };

    const message = buildCwlRosterMessage("November CWL", clan);

    const embed = message.embeds?.[0];
    expect(embed?.title).toBe("MiniPoint CWL Roster");
    expect(embed?.url).toBe(clan.link);
    expect(embed?.description).toContain("<@123> | `#PLAYER1`");
    const actionRow = message.components?.[0];
    if (!actionRow || !("components" in actionRow)) {
      throw new Error("Expected an action row with a signup button.");
    }
    expect(actionRow.components[0]).toMatchObject({
      label: "Sign up for MiniPoint",
      custom_id: "cwl_roster_signup:2CYP9C9QG:November CWL",
    });
  });
});
