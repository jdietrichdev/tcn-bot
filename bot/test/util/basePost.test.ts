import {
  buildBasePostEmbeds,
  buildBasePostPayload,
  CLAN_CASTLE_TROOP_IMAGE_FILENAME,
  isBasePostRecord,
} from "../../src/util/basePost";
import type { BasePostRecord } from "../../src/util/basePost";

const basePost: BasePostRecord = {
  guildId: "123",
  channelId: "456",
  messageId: "789",
  baseId: 1,
  baseLink: "https://link.clashofclans.com/en?action=OpenLayout&id=abc",
  clanCastle: "2x Ice Golem, 1x Baby Dragon",
  clanCastleTroops: [
    { slug: "ice_golem", quantity: 2 },
    { slug: "baby_dragon", quantity: 1 },
    { slug: "ice_hound", quantity: 1 },
  ],
  clanCastleTroopEmojiIds: {
    ice_golem: "1001",
    baby_dragon: "1002",
    ice_hound: "1003",
  },
  clanCastleAttachment: {
    id: "987654321",
    filename: CLAN_CASTLE_TROOP_IMAGE_FILENAME,
  },
  league: "CWL",
  imageUrl: "https://cdn.example/base.png",
  builderName: "Builder",
  downloads: 0,
  positiveVotes: 0,
  negativeVotes: 0,
};

describe("base-post Clan Castle embeds", () => {
  it("renders troop emojis and counts inline, grouped by troop type", () => {
    const embeds = buildBasePostEmbeds(basePost);
    const payload = buildBasePostPayload(
      basePost,
      "https://api.example/prod/base-post"
    );
    const troopField = embeds[0].fields?.find(
      (field) => field.name === "Clan Castle Troops"
    );

    expect(embeds).toHaveLength(1);
    expect(troopField?.value).toBe(
      [
        "**Troops**",
        "<:cc_ice_golem:1001> `x2` Ice Golem",
        "<:cc_baby_dragon:1002> `x1` Baby Dragon",
        "",
        "**Super Troops**",
        "<:cc_ice_hound:1003> `x1` Ice Hound",
      ].join("\n")
    );
    expect(embeds[0].image?.url).toBe(basePost.imageUrl);
    expect(payload.attachments).toEqual([]);
  });

  it("continues rendering legacy posts that have no emoji map", () => {
    const legacyPost: BasePostRecord = {
      ...basePost,
      clanCastleTroops: undefined,
      clanCastleTroopEmojiIds: undefined,
      clanCastleAttachment: undefined,
    };

    const embeds = buildBasePostEmbeds(legacyPost);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].fields?.[0]).toMatchObject({
      name: "Clan Castle",
      value: legacyPost.clanCastle,
    });
    expect(
      buildBasePostPayload(
        legacyPost,
        "https://api.example/prod/base-post"
      ).attachments
    ).toBeUndefined();
  });

  it("rejects a troop list when an emoji mapping is missing", () => {
    expect(() =>
      buildBasePostEmbeds({
        ...basePost,
        clanCastleTroopEmojiIds: { ice_golem: "1001" },
      })
    ).toThrow("Missing ClashKing application emoji for baby_dragon.");
  });

  it("accepts only well-formed stored emoji IDs", () => {
    expect(isBasePostRecord(basePost)).toBe(true);
    expect(
      isBasePostRecord({
        ...basePost,
        clanCastleTroopEmojiIds: { ice_golem: "not-an-id" },
      })
    ).toBe(false);
  });
});
