import { describe, it, expect } from "vitest";
import { moderateContent } from "../../moderation";

describe("moderateContent", () => {
  // -----------------------------------------------------------------------
  // Clean content → APPROVED
  // -----------------------------------------------------------------------
  it("approves clean content with score < 0.3", () => {
    const result = moderateContent("Just had the best coffee at this new spot downtown");
    expect(result.approved).toBe(true);
    expect(result.score).toBeLessThan(0.3);
    expect(result.flags).toHaveLength(0);
    expect(result.reason).toBeNull();
  });

  it("approves normal social media captions", () => {
    const result = moderateContent("Working on a new painting today, the light in my studio is perfect");
    expect(result.approved).toBe(true);
    expect(result.score).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Blocked patterns → instant REJECTED (score 1.0)
  // -----------------------------------------------------------------------
  it("instantly rejects hate speech patterns", () => {
    const result = moderateContent("kill all the enemies in this game");
    expect(result.approved).toBe(false);
    expect(result.score).toBe(1.0);
    expect(result.flags).toContain("blocked_content");
  });

  it("instantly rejects SSN patterns", () => {
    const result = moderateContent("my number is 123-45-6789 call me");
    expect(result.approved).toBe(false);
    expect(result.score).toBe(1.0);
    expect(result.flags).toContain("blocked_content");
  });

  // -----------------------------------------------------------------------
  // Flagged keywords → score increases by 0.15 each
  // -----------------------------------------------------------------------
  it("flags violence keywords with +0.15 score", () => {
    const result = moderateContent("This new weapon skin in the game looks amazing");
    expect(result.flags).toContain("violence");
    expect(result.score).toBeGreaterThanOrEqual(0.15);
  });

  it("flags drug keywords", () => {
    const result = moderateContent("The fentanyl crisis is devastating communities across the country");
    expect(result.flags).toContain("drugs");
    expect(result.score).toBeGreaterThanOrEqual(0.15);
  });

  it("flags scam patterns", () => {
    const result = moderateContent("Send me crypto and get rich quick");
    expect(result.flags).toContain("scam");
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  // -----------------------------------------------------------------------
  // Spam patterns → score increases by 0.2 each
  // -----------------------------------------------------------------------
  it("flags repeated characters as spam", () => {
    const result = moderateContent("Woooooooooooooow this is amazing");
    expect(result.flags).toContain("spam");
    expect(result.score).toBeGreaterThanOrEqual(0.2);
  });

  it("flags marketing phrases as spam", () => {
    const result = moderateContent("Buy now before this limited offer expires, act fast!");
    expect(result.flags).toContain("spam");
  });

  // -----------------------------------------------------------------------
  // Threshold boundaries
  // -----------------------------------------------------------------------
  it("rejects content with score >= 0.6", () => {
    // Multiple flagged categories should push past 0.6
    const result = moderateContent("Send me crypto for cocaine, guaranteed returns on heroin");
    expect(result.approved).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it("marks content as pending review for score 0.3-0.59", () => {
    // Two flagged keywords = 0.3 → pending
    const result = moderateContent("This shooting game has amazing weapon mechanics");
    expect(result.approved).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.score).toBeLessThan(0.6);
    expect(result.reason).toContain("Pending manual review");
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it("flags content that is too short", () => {
    const result = moderateContent("x");
    expect(result.flags).toContain("too_short");
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it("flags excessively long content", () => {
    const long = "a".repeat(5001);
    const result = moderateContent(long);
    expect(result.flags).toContain("too_long");
  });

  it("flags ALL CAPS content over 50 chars", () => {
    const shouty = "THIS IS A REALLY LONG SENTENCE WRITTEN IN ALL CAPS FOR NO GOOD REASON AT ALL";
    const result = moderateContent(shouty);
    expect(result.flags).toContain("excessive_caps");
  });

  it("caps score at 1.0", () => {
    // Stack many flags to exceed 1.0
    const toxic = "Buy now cocaine heroin meth fentanyl send me crypto guaranteed returns aaaaaaaaaaaaa";
    const result = moderateContent(toxic);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});
