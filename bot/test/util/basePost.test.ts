import {
  buildBasePostEmbeds,
  buildBasePostPayload,
  CLAN_CASTLE_TROOP_IMAGE_FILENAME,
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
  ],
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
  it("adds the troop graphic and retains its attachment when refreshing controls", () => {
    const embeds = buildBasePostEmbeds(basePost);
    const payload = buildBasePostPayload(
      basePost,
      "https://api.example/prod/base-post"
    );

    expect(embeds).toHaveLength(2);
    expect(embeds[1].image?.url).toBe(
      `attachment://${CLAN_CASTLE_TROOP_IMAGE_FILENAME}`
    );
    expect(payload.attachments).toEqual([basePost.clanCastleAttachment]);
  });

  it("keeps legacy base posts as a single embed", () => {
    const legacyPost: BasePostRecord = {
      ...basePost,
      clanCastleTroops: undefined,
      clanCastleAttachment: undefined,
    };

    expect(buildBasePostEmbeds(legacyPost)).toHaveLength(1);
    expect(
      buildBasePostPayload(
        legacyPost,
        "https://api.example/prod/base-post"
      ).attachments
    ).toBeUndefined();
  });
});
