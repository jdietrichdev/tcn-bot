import {
  getCwlLeagueRank,
  getCwlSignupReview,
} from "../../src/util/cwlSignupEligibility";

const previousStats = (averageStars: number, league = "Champion League I") => ({
  season: "2026-10",
  league,
  averageStars,
  attackCount: 7,
});

describe("CWL signup review rules", () => {
  it("does not require a tryout for Master CWL or below", () => {
    expect(
      getCwlSignupReview("Master League I", previousStats(1.5)).requiresTicket
    ).toBe(false);
  });

  it("requires a ticket at 2.2 stars or below for the same or a higher league", () => {
    expect(
      getCwlSignupReview(
        "Champion League I",
        previousStats(2.2)
      ).requiresTicket
    ).toBe(true);
    expect(
      getCwlSignupReview(
        "Champion League II",
        previousStats(2.2)
      ).requiresTicket
    ).toBe(false);
  });

  it("requires a ticket below 2.8 stars to move up, but allows the same league above 2.2", () => {
    expect(
      getCwlSignupReview(
        "Champion League I",
        previousStats(2.79, "Champion League II")
      ).requiresTicket
    ).toBe(true);
    expect(
      getCwlSignupReview(
        "Champion League II",
        previousStats(2.21, "Champion League II")
      ).requiresTicket
    ).toBe(false);
  });

  it("allows a non-Titan promotion at exactly 2.8 stars", () => {
    expect(
      getCwlSignupReview(
        "Champion League I",
        previousStats(2.8, "Master League I")
      ).requiresTicket
    ).toBe(false);
  });

  it("requires a first-time Titan ticket at the 2.8-star promotion threshold", () => {
    expect(
      getCwlSignupReview(
        "Titan I CWL",
        previousStats(2.8, "Champion League I")
      ).requiresTicket
    ).toBe(true);
    expect(
      getCwlSignupReview(
        "Titan I CWL",
        previousStats(2.8, "Titan II CWL")
      ).requiresTicket
    ).toBe(false);
  });

  it("requires Titan II/III promotion-qualified players to try out for Legends", () => {
    expect(
      getCwlSignupReview(
        "Legends CWL",
        previousStats(2.8, "Titan III CWL")
      )
    ).toEqual({
      requiresTicket: true,
      reason:
        "Your average meets the Titan II/III promotion requirement, but Legends CWL requires a tryout.",
    });
    expect(
      getCwlSignupReview(
        "Legends CWL",
        previousStats(3, "Titan II CWL")
      ).requiresTicket
    ).toBe(true);
  });

  it("requires Titan II/III stay-qualified players to ticket for Titan I or Legends", () => {
    expect(
      getCwlSignupReview(
        "Titan I CWL",
        previousStats(2.3, "Titan III CWL")
      ).requiresTicket
    ).toBe(true);
    expect(
      getCwlSignupReview(
        "Legends CWL",
        previousStats(2.79, "Titan II CWL")
      ).requiresTicket
    ).toBe(true);
    expect(
      getCwlSignupReview(
        "Titan I CWL",
        previousStats(2.8, "Titan II CWL")
      ).requiresTicket
    ).toBe(false);
    expect(
      getCwlSignupReview(
        "Legends CWL",
        previousStats(2.8, "Titan II CWL")
      ).requiresTicket
    ).toBe(true);
  });

  it("does not apply the Titan II/III tryout rule to Titan I members", () => {
    expect(
      getCwlSignupReview(
        "Legends CWL",
        previousStats(2.8, "Titan I CWL")
      ).requiresTicket
    ).toBe(false);
  });

  it("requires review when previous CWL performance is unavailable", () => {
    expect(
      getCwlSignupReview("Champion League I", undefined).requiresTicket
    ).toBe(true);
  });

  it("ranks league tiers for same-or-higher comparisons", () => {
    expect(getCwlLeagueRank("Champion League I")).toBe(18);
    expect(getCwlLeagueRank("Titan III CWL")).toBe(19);
    expect(getCwlLeagueRank("Legends CWL")).toBe(22);
  });
});
