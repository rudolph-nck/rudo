import { describe, it, expect } from "vitest";
import {
  TIER_CAPABILITIES,
  decidePostType,
  pickVideoDuration,
} from "../types";

describe("TIER_CAPABILITIES", () => {
  it("defines all expected tiers", () => {
    expect(TIER_CAPABILITIES).toHaveProperty("SPARK");
    expect(TIER_CAPABILITIES).toHaveProperty("PULSE");
    expect(TIER_CAPABILITIES).toHaveProperty("GRID");
    expect(TIER_CAPABILITIES).toHaveProperty("ADMIN");
  });

  it("SPARK has no trend awareness", () => {
    expect(TIER_CAPABILITIES.SPARK.trendAware).toBe(false);
  });

  it("PULSE has trend awareness", () => {
    expect(TIER_CAPABILITIES.PULSE.trendAware).toBe(true);
  });

  it("GRID has premium model and character ref support", () => {
    expect(TIER_CAPABILITIES.GRID.premiumModel).toBe(true);
    expect(TIER_CAPABILITIES.GRID.canUploadCharacterRef).toBe(true);
  });

  it("video duration weights sum to ~1.0 for each tier", () => {
    for (const [tier, caps] of Object.entries(TIER_CAPABILITIES)) {
      const sum = caps.videoDurationMix.reduce((s, d) => s + d.weight, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });
});

describe("decidePostType", () => {
  it("returns IMAGE or VIDEO", () => {
    const result = decidePostType("SPARK");
    expect(["IMAGE", "VIDEO"]).toContain(result);
  });

  it("falls back to SPARK for unknown tier", () => {
    // Should not throw
    const result = decidePostType("NONEXISTENT");
    expect(["IMAGE", "VIDEO"]).toContain(result);
  });
});

describe("pickVideoDuration", () => {
  it("SPARK always returns 6", () => {
    // SPARK only has 6s in its mix
    for (let i = 0; i < 20; i++) {
      expect(pickVideoDuration("SPARK")).toBe(6);
    }
  });

  it("PULSE returns 6 or 15", () => {
    const durations = new Set<number>();
    for (let i = 0; i < 100; i++) {
      durations.add(pickVideoDuration("PULSE"));
    }
    expect(durations.has(6)).toBe(true);
    expect(durations.has(15)).toBe(true);
    expect(durations.has(30)).toBe(false);
  });

  it("GRID can return 6, 15, or 30", () => {
    const durations = new Set<number>();
    for (let i = 0; i < 500; i++) {
      durations.add(pickVideoDuration("GRID"));
    }
    expect(durations.has(6)).toBe(true);
    expect(durations.has(15)).toBe(true);
    // 30s is 8% chance — with 500 iterations very likely to appear
    expect(durations.has(30)).toBe(true);
  });

  it("falls back to SPARK for unknown tier", () => {
    const result = pickVideoDuration("NONEXISTENT");
    expect(result).toBe(6);
  });
});
