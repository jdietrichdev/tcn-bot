import {
  buildBasePostEmbeds,
  buildBasePostFeedbackThreadMessage,
  buildBasePostPayload,
  BASE_POST_IMAGE_JPEG_FILENAME,
  CLAN_CASTLE_TROOP_IMAGE_FILENAME,
  canEditBasePost,
  getRecommendedLeagueEmojiKey,
  isBasePostRecord,
} from "../../src/util/basePost";
import type { BasePostRecord } from "../../src/util/basePost";

const basePost: BasePostRecord = {
  guildId: "123",
  channelId: "456",
  messageId: "789",
  builderId: "123",
  feedbackThreadId: "555",
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
  leagueEmojiId: "2001",
  imageUrl: "https://cdn.example/base.png",
  builderName: "Builder",
  downloads: 0,
  positiveVotes: 0,
  negativeVotes: 0,
};

describe("base-post Clan Castle embeds", () => {
  it("renders troop emojis, counts, and names without redundant group headings", () => {
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
        "<:cc_ice_golem:1001> `x2` Ice Golem",
        "<:cc_baby_dragon:1002> `x1` Baby Dragon",
        "<:cc_ice_hound:1003> `x1` Ice Hound",
      ].join("\n")
    );
    expect(troopField?.value).not.toContain("Troops");
    expect(embeds[0].image?.url).toBe(basePost.imageUrl);
    expect(embeds[0].description).toBe(
      "**Recommended League**\n> <:league_cwl:2001> **CWL**"
    );
    expect(embeds[0].fields?.find((field) => field.name === "Shared by")?.value)
      .toBe("**Builder**");
    expect(payload.attachments).toEqual([]);
    expect(
      payload.components[1].components.map((button) =>
        "custom_id" in button ? button.custom_id : undefined
      )
    ).toEqual(["base_post_feedback", "base_post_settings"]);
    expect(payload.components[1].components[0]).toMatchObject({
      disabled: false,
    });
  });

  it("continues rendering legacy posts that have no emoji map", () => {
    const legacyPost: BasePostRecord = {
      ...basePost,
      clanCastleTroops: undefined,
      clanCastleTroopEmojiIds: undefined,
      clanCastleAttachment: undefined,
      leagueEmojiId: undefined,
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
    expect(
      isBasePostRecord({
        ...basePost,
        leagueEmojiId: "not-an-id",
      })
    ).toBe(false);
  });

  it("preserves an uploaded base image and recognizes JPEG image metadata", () => {
    const imagePost: BasePostRecord = {
      ...basePost,
      clanCastleAttachment: undefined,
      imageUrl: `attachment://${BASE_POST_IMAGE_JPEG_FILENAME}`,
      imageAttachment: {
        id: "987654322",
        filename: BASE_POST_IMAGE_JPEG_FILENAME,
      },
    };

    expect(isBasePostRecord(imagePost)).toBe(true);
    expect(
      buildBasePostPayload(imagePost, "https://api.example/prod/base-post")
        .attachments
    ).toEqual([imagePost.imageAttachment]);
  });

  it("allows only the builder or configured admins to edit a base post", () => {
    expect(canEditBasePost(basePost, "123", [], "admin-role")).toBe(true);
    expect(canEditBasePost(basePost, "999", ["admin-role"], "admin-role")).toBe(
      true
    );
    expect(canEditBasePost(basePost, "999", [], "admin-role")).toBe(false);
  });

  it("builds a feedback starter with the original-post link and one base-link button", () => {
    const starter = buildBasePostFeedbackThreadMessage(basePost);

    expect(starter.content).toContain(
      "https://discord.com/channels/123/456/789"
    );
    expect(starter.embeds).toEqual(buildBasePostEmbeds(basePost));
    expect(starter.components).toHaveLength(1);
    expect(starter.components[0].components).toHaveLength(1);
    expect(starter.components[0].components[0]).toMatchObject({
      label: "Base Link",
      url: basePost.baseLink,
    });
  });

  it("maps all recommended leagues to their application emoji keys", () => {
    expect(
      [
        "Legends 1",
        "Legends 2",
        "Legends 3",
        "Legends 2/3",
        "CWL",
        "Titan I CWL",
        "Titan II CWL",
        "Titan III CWL",
      ].map(getRecommendedLeagueEmojiKey)
    ).toEqual([
      "legends_1",
      "legends_2",
      "legends_3",
      "legends_2_3",
      "cwl",
      "titan_1_cwl",
      "titan_2_cwl",
      "titan_3_cwl",
    ]);
  });

  it("uses a blockquote to distinguish builder notes from the troop list", () => {
    const embed = buildBasePostEmbeds({
      ...basePost,
      notes: "Try this base in war.\nProtect the Town Hall.",
    })[0];

    expect(
      embed.fields?.find((field) => field.name === "Builder Notes")?.value
    ).toBe("> Try this base in war.\n> Protect the Town Hall.");
  });
});
