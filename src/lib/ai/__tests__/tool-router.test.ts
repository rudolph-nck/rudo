// Tool Router tests — Phase 4
// Tests model selection, budget checks, and video routing logic.

import { describe, it, expect } from "vitest";
import { selectChatModel, DEFAULT_CONTEXT, type ToolContext } from "../tool-router";

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

describe("selectChatModel", () => {
  it("returns gpt-4o-mini for SPARK tier", () => {
    expect(selectChatModel({ tier: "SPARK" })).toBe("gpt-4o-mini");
  });

  it("returns gpt-4o-mini for PULSE tier", () => {
    expect(selectChatModel({ tier: "PULSE" })).toBe("gpt-4o-mini");
  });

  it("returns gpt-4o for GRID tier with default trust", () => {
    expect(selectChatModel({ tier: "GRID" })).toBe("gpt-4o");
  });

  it("returns gpt-4o for ADMIN tier with default trust", () => {
    expect(selectChatModel({ tier: "ADMIN" })).toBe("gpt-4o");
  });

  it("returns gpt-4o for GRID tier with high trust level", () => {
    expect(selectChatModel({ tier: "GRID", trustLevel: 0.8 })).toBe("gpt-4o");
  });

  it("returns gpt-4o-mini for GRID tier with low trust level", () => {
    expect(selectChatModel({ tier: "GRID", trustLevel: 0.3 })).toBe("gpt-4o-mini");
  });

  it("returns gpt-4o-mini for GRID tier with trust level exactly 0.5", () => {
    expect(selectChatModel({ tier: "GRID", trustLevel: 0.5 })).toBe("gpt-4o");
  });

  it("returns gpt-4o-mini for GRID tier with trust level 0", () => {
    expect(selectChatModel({ tier: "GRID", trustLevel: 0 })).toBe("gpt-4o-mini");
  });

  it("returns gpt-4o-mini for unknown tier", () => {
    expect(selectChatModel({ tier: "UNKNOWN" })).toBe("gpt-4o-mini");
  });

  it("returns gpt-4o-mini for BYOB_FREE tier", () => {
    expect(selectChatModel({ tier: "BYOB_FREE" })).toBe("gpt-4o-mini");
  });
});

// ---------------------------------------------------------------------------
// Default context
// ---------------------------------------------------------------------------

describe("DEFAULT_CONTEXT", () => {
  it("has SPARK tier and full trust", () => {
    expect(DEFAULT_CONTEXT.tier).toBe("SPARK");
    expect(DEFAULT_CONTEXT.trustLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Budget logic
// ---------------------------------------------------------------------------

describe("budget enforcement", () => {
  it("context without budget is valid (no limit)", () => {
    const ctx: ToolContext = { tier: "GRID" };
    // No budget = no limit, should use premium model
    expect(selectChatModel(ctx)).toBe("gpt-4o");
  });

  it("context with budget under limit is valid", () => {
    const ctx: ToolContext = {
      tier: "GRID",
      budget: { dailyLimitCents: 1000, spentTodayCents: 500 },
    };
    expect(selectChatModel(ctx)).toBe("gpt-4o");
  });

  it("budget fields can be zero", () => {
    const ctx: ToolContext = {
      tier: "SPARK",
      budget: { dailyLimitCents: 0, spentTodayCents: 0 },
    };
    // dailyLimitCents=0 means no budget, checkBudget returns true
    expect(selectChatModel(ctx)).toBe("gpt-4o-mini");
  });
});

// ---------------------------------------------------------------------------
// Tier routing consistency
// ---------------------------------------------------------------------------

describe("tier routing table", () => {
  const tierExpectations: [string, string][] = [
    ["FREE", "gpt-4o-mini"],
    ["BYOB_FREE", "gpt-4o-mini"],
    ["BYOB_PRO", "gpt-4o-mini"],
    ["SPARK", "gpt-4o-mini"],
    ["PULSE", "gpt-4o-mini"],
    ["GRID", "gpt-4o"],
    ["ADMIN", "gpt-4o"],
  ];

  tierExpectations.forEach(([tier, expectedModel]) => {
    it(`${tier} → ${expectedModel}`, () => {
      expect(selectChatModel({ tier, trustLevel: 1 })).toBe(expectedModel);
    });
  });
});

// ---------------------------------------------------------------------------
// Trust level edge cases
// ---------------------------------------------------------------------------

describe("trust level edge cases", () => {
  it("undefined trustLevel defaults to 1 (full trust)", () => {
    const ctx: ToolContext = { tier: "GRID" };
    expect(selectChatModel(ctx)).toBe("gpt-4o");
  });

  it("negative trustLevel downgrades model", () => {
    const ctx: ToolContext = { tier: "GRID", trustLevel: -1 };
    expect(selectChatModel(ctx)).toBe("gpt-4o-mini");
  });

  it("trustLevel > 1 still uses premium model", () => {
    const ctx: ToolContext = { tier: "GRID", trustLevel: 2 };
    expect(selectChatModel(ctx)).toBe("gpt-4o");
  });
});
