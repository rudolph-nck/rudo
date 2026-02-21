// Strategy tests — Phase 5
// Tests hook classification, weight extraction, format bias, and strategy context building.

import { describe, it, expect } from "vitest";
import {
  classifyHook,
  extractTopicWeights,
  extractFormatWeights,
  extractHookWeights,
  calculatePostRateBias,
  buildStrategyContext,
  type StrategyWeights,
} from "../strategy";
import { decidePostType, pickVideoDuration } from "../ai/types";

// ---------------------------------------------------------------------------
// Hook classification
// ---------------------------------------------------------------------------

describe("classifyHook", () => {
  it("detects question hooks", () => {
    expect(classifyHook("Why do we always end up here?")).toBe("question");
    expect(classifyHook("What if I told you this is real?")).toBe("question");
  });

  it("detects exclamation hooks", () => {
    expect(classifyHook("!!! This is insane")).toBe("exclamation");
    expect(classifyHook("NO WAY! Just happened.")).toBe("exclamation");
  });

  it("detects hot take hooks", () => {
    expect(classifyHook("Honestly, nobody talks about this enough")).toBe("hot_take");
    expect(classifyHook("Hot take: pineapple on pizza is elite")).toBe("hot_take");
    expect(classifyHook("Unpopular opinion but here we go")).toBe("hot_take");
    expect(classifyHook("ngl this hit different")).toBe("hot_take");
  });

  it("detects story hooks", () => {
    expect(classifyHook("So I was walking downtown and...")).toBe("story");
    expect(classifyHook("Yesterday I discovered something wild")).toBe("story");
    expect(classifyHook("Last night was one for the books")).toBe("story");
  });

  it("detects observation hooks", () => {
    expect(classifyHook("That moment when the code finally compiles")).toBe("observation");
    expect(classifyHook("The way coffee hits at 6am is unmatched")).toBe("observation");
  });

  it("detects punchy hooks (short declarative)", () => {
    expect(classifyHook("Built different")).toBe("punchy");
    expect(classifyHook("Main character energy")).toBe("punchy");
  });

  it("classifies longer declarative statements", () => {
    expect(classifyHook("The sun was setting over the city as I thought about what matters most in the grand scheme of things")).toBe("statement");
  });

  it("returns other for empty content", () => {
    expect(classifyHook("")).toBe("other");
    expect(classifyHook("   ")).toBe("other");
  });
});

// ---------------------------------------------------------------------------
// Topic weight extraction
// ---------------------------------------------------------------------------

describe("extractTopicWeights", () => {
  const topPosts = [
    { content: "post", type: "IMAGE", tags: ["cyberpunk", "neon"], videoDuration: null, score: 10, likes: 8, comments: 2 },
    { content: "post", type: "IMAGE", tags: ["cyberpunk", "digital art"], videoDuration: null, score: 8, likes: 6, comments: 2 },
  ];
  const bottomPosts = [
    { content: "post", type: "IMAGE", tags: ["nature", "landscape"], videoDuration: null, score: 1, likes: 1, comments: 0 },
  ];

  it("boosts tags from top posts", () => {
    const weights = extractTopicWeights(topPosts, bottomPosts);
    expect(weights["cyberpunk"]).toBeGreaterThan(0);
    expect(weights["neon"]).toBeGreaterThan(0);
    expect(weights["digital art"]).toBeGreaterThan(0);
  });

  it("penalizes tags from bottom posts", () => {
    const weights = extractTopicWeights(topPosts, bottomPosts);
    expect(weights["nature"]).toBeLessThan(0);
    expect(weights["landscape"]).toBeLessThan(0);
  });

  it("clamps weights to [-1, 1]", () => {
    // Run many iterations to push weights to extreme
    let weights: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      weights = extractTopicWeights(topPosts, bottomPosts, weights);
    }
    for (const w of Object.values(weights)) {
      expect(w).toBeGreaterThanOrEqual(-1);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("decays existing weights", () => {
    const existing = { "old_tag": 0.5 };
    const weights = extractTopicWeights([], [], existing);
    expect(weights["old_tag"]).toBeLessThan(0.5);
  });

  it("removes near-zero weights after decay", () => {
    const existing = { "fading": 0.04 };
    const weights = extractTopicWeights([], [], existing);
    expect(weights["fading"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Format weight extraction
// ---------------------------------------------------------------------------

describe("extractFormatWeights", () => {
  it("boosts IMAGE when top posts are images", () => {
    const top = [
      { content: "", type: "IMAGE", tags: [], videoDuration: null, score: 10, likes: 8, comments: 2 },
      { content: "", type: "IMAGE", tags: [], videoDuration: null, score: 9, likes: 7, comments: 2 },
    ];
    const bottom = [
      { content: "", type: "VIDEO", tags: [], videoDuration: 6, score: 1, likes: 1, comments: 0 },
    ];
    const weights = extractFormatWeights(top, bottom);
    expect(weights["IMAGE"]).toBeGreaterThan(0);
    expect(weights["VIDEO_6"]).toBeLessThan(0);
  });

  it("distinguishes video durations", () => {
    const top = [
      { content: "", type: "VIDEO", tags: [], videoDuration: 15, score: 10, likes: 8, comments: 2 },
    ];
    const weights = extractFormatWeights(top, []);
    expect(weights["VIDEO_15"]).toBeGreaterThan(0);
    expect(weights["VIDEO_6"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Hook weight extraction
// ---------------------------------------------------------------------------

describe("extractHookWeights", () => {
  it("boosts hooks from top posts", () => {
    const top = [
      { content: "Why does this always happen?", type: "IMAGE", tags: [], videoDuration: null, score: 10, likes: 8, comments: 2 },
      { content: "Honestly this is peak content", type: "IMAGE", tags: [], videoDuration: null, score: 9, likes: 7, comments: 2 },
    ];
    const weights = extractHookWeights(top, []);
    expect(weights["question"]).toBeGreaterThan(0);
    expect(weights["hot_take"]).toBeGreaterThan(0);
  });

  it("penalizes hooks from bottom posts", () => {
    const bottom = [
      { content: "The sunset was absolutely breathtaking today and I can't stop thinking about how beautiful life is", type: "IMAGE", tags: [], videoDuration: null, score: 1, likes: 0, comments: 0 },
    ];
    const weights = extractHookWeights([], bottom);
    expect(weights["statement"]).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Post rate bias
// ---------------------------------------------------------------------------

describe("calculatePostRateBias", () => {
  it("returns positive bias when avg is close to top", () => {
    const bias = calculatePostRateBias(8, 10);
    expect(bias).toBeGreaterThan(0);
  });

  it("returns negative bias when avg is much lower than top", () => {
    const bias = calculatePostRateBias(1, 10);
    expect(bias).toBeLessThan(0);
  });

  it("clamps to [-1, 1]", () => {
    const bias = calculatePostRateBias(100, 10, 0.95);
    expect(bias).toBeLessThanOrEqual(1);
    expect(bias).toBeGreaterThanOrEqual(-1);
  });

  it("decays existing bias", () => {
    const bias = calculatePostRateBias(5, 10, 0.5);
    // Existing bias of 0.5 should decay before new nudge
    expect(bias).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Strategy context building
// ---------------------------------------------------------------------------

describe("buildStrategyContext", () => {
  it("returns empty string when all weights are zero", () => {
    const strategy: StrategyWeights = {
      topicWeights: {},
      formatWeights: {},
      hookWeights: {},
      postRateBias: 0,
      replyRateBias: 0,
    };
    expect(buildStrategyContext(strategy)).toBe("");
  });

  it("includes topic hints for high-weight topics", () => {
    const strategy: StrategyWeights = {
      topicWeights: { "cyberpunk": 0.8, "neon": 0.5, "filler": 0.01 },
      formatWeights: {},
      hookWeights: {},
      postRateBias: 0,
      replyRateBias: 0,
    };
    const ctx = buildStrategyContext(strategy);
    expect(ctx).toContain("cyberpunk");
    expect(ctx).toContain("neon");
    expect(ctx).not.toContain("filler");
  });

  it("includes avoidance hints for negative-weight topics", () => {
    const strategy: StrategyWeights = {
      topicWeights: { "nature": -0.5 },
      formatWeights: {},
      hookWeights: {},
      postRateBias: 0,
      replyRateBias: 0,
    };
    const ctx = buildStrategyContext(strategy);
    expect(ctx).toContain("nature");
    expect(ctx).toContain("underperform");
  });

  it("includes hook style hints", () => {
    const strategy: StrategyWeights = {
      topicWeights: {},
      formatWeights: {},
      hookWeights: { "question": 0.6, "hot_take": 0.4 },
      postRateBias: 0,
      replyRateBias: 0,
    };
    const ctx = buildStrategyContext(strategy);
    expect(ctx).toContain("asking questions");
    expect(ctx).toContain("hot takes");
  });

  it("contains STRATEGY header", () => {
    const strategy: StrategyWeights = {
      topicWeights: { "art": 0.5 },
      formatWeights: {},
      hookWeights: {},
      postRateBias: 0,
      replyRateBias: 0,
    };
    const ctx = buildStrategyContext(strategy);
    expect(ctx).toContain("STRATEGY");
  });
});

// ---------------------------------------------------------------------------
// Format-biased post type decisions (Phase 5 integration)
// ---------------------------------------------------------------------------

describe("format-biased decisions", () => {
  it("decidePostType still works without format weights", () => {
    // Should not throw — backwards compatible
    const result = decidePostType("SPARK");
    expect(["IMAGE", "VIDEO", "STYLED_TEXT"]).toContain(result);
  });

  it("decidePostType still works with empty format weights", () => {
    const result = decidePostType("SPARK", {});
    expect(["IMAGE", "VIDEO", "STYLED_TEXT"]).toContain(result);
  });

  it("pickVideoDuration still works without format weights", () => {
    const result = pickVideoDuration("GRID");
    expect([6, 15, 30]).toContain(result);
  });

  it("pickVideoDuration still works with format weights", () => {
    const result = pickVideoDuration("GRID", { "VIDEO_15": 0.8 });
    expect([6, 15, 30]).toContain(result);
  });
});
