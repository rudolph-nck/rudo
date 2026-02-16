// Telemetry tests — Phase 6
// Tests the telemetry ring buffer, cost estimation, stats aggregation,
// and budget enforcement logic.

import { describe, it, expect, beforeEach } from "vitest";
import {
  withTelemetry,
  getEntries,
  clearEntries,
  getStats,
  estimateCostCents,
  type TelemetryContext,
} from "../telemetry";
import {
  checkBudget,
  type ToolContext,
  type BudgetCheckResult,
} from "../tool-router";

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

describe("estimateCostCents", () => {
  it("returns known cost for gpt-4o", () => {
    expect(estimateCostCents("gpt-4o")).toBe(1.5);
  });

  it("returns known cost for gpt-4o-mini", () => {
    expect(estimateCostCents("gpt-4o-mini")).toBe(0.15);
  });

  it("returns known cost for fal image model", () => {
    expect(estimateCostCents("fal-ai/flux/dev")).toBe(3.0);
  });

  it("returns known cost for fal video model", () => {
    expect(estimateCostCents("fal-ai/kling-video/v2/master/text-to-video")).toBe(15.0);
  });

  it("returns known cost for Runway model", () => {
    expect(estimateCostCents("gen3a_turbo")).toBe(50.0);
  });

  it("returns default cost for unknown model", () => {
    expect(estimateCostCents("unknown-model")).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Telemetry ring buffer
// ---------------------------------------------------------------------------

describe("telemetry ring buffer", () => {
  beforeEach(() => {
    clearEntries();
  });

  it("records a successful call", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "SPARK",
      budgetExceeded: false,
    };

    const result = await withTelemetry(ctx, async () => "hello");
    expect(result).toBe("hello");

    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].success).toBe(true);
    expect(entries[0].capability).toBe("caption");
    expect(entries[0].provider).toBe("openai");
    expect(entries[0].model).toBe("gpt-4o-mini");
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(entries[0].estimatedCostCents).toBe(0.15);
  });

  it("records a failed call", async () => {
    const ctx: TelemetryContext = {
      capability: "image",
      provider: "fal",
      model: "fal-ai/flux/dev",
      tier: "PULSE",
      budgetExceeded: false,
    };

    await expect(
      withTelemetry(ctx, async () => {
        throw new Error("API error");
      })
    ).rejects.toThrow("API error");

    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].success).toBe(false);
    expect(entries[0].error).toBe("API error");
    expect(entries[0].estimatedCostCents).toBe(0); // no cost on failure
  });

  it("records null image result as failure", async () => {
    const ctx: TelemetryContext = {
      capability: "image",
      provider: "fal",
      model: "fal-ai/flux/dev",
      tier: "SPARK",
      budgetExceeded: false,
    };

    const result = await withTelemetry(ctx, async () => null);
    expect(result).toBeNull();

    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].success).toBe(false);
    expect(entries[0].error).toBe("Provider returned null");
  });

  it("records null video result as failure", async () => {
    const ctx: TelemetryContext = {
      capability: "video",
      provider: "fal",
      model: "fal-ai/kling-video/v2/master/text-to-video",
      tier: "SPARK",
      budgetExceeded: false,
    };

    const result = await withTelemetry(ctx, async () => null);
    expect(result).toBeNull();

    const entries = getEntries();
    expect(entries[0].success).toBe(false);
  });

  it("does not flag null caption result as failure", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "SPARK",
      budgetExceeded: false,
    };

    await withTelemetry(ctx, async () => null);

    const entries = getEntries();
    expect(entries[0].success).toBe(true);
  });

  it("tracks budgetExceeded flag", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "GRID",
      budgetExceeded: true,
    };

    await withTelemetry(ctx, async () => "ok");

    const entries = getEntries();
    expect(entries[0].budgetExceeded).toBe(true);
  });

  it("limits entries to ring buffer max", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "SPARK",
      budgetExceeded: false,
    };

    // Push 210 entries (max is 200)
    for (let i = 0; i < 210; i++) {
      await withTelemetry(ctx, async () => "ok");
    }

    expect(getEntries()).toHaveLength(200);
  });
});

// ---------------------------------------------------------------------------
// Stats aggregation
// ---------------------------------------------------------------------------

describe("getStats", () => {
  beforeEach(() => {
    clearEntries();
  });

  it("returns zero stats when empty", () => {
    const stats = getStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.failureCount).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
  });

  it("aggregates success and failure counts", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "SPARK",
      budgetExceeded: false,
    };

    await withTelemetry(ctx, async () => "ok");
    await withTelemetry(ctx, async () => "ok");
    try {
      await withTelemetry(ctx, async () => {
        throw new Error("fail");
      });
    } catch {}

    const stats = getStats();
    expect(stats.totalCalls).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failureCount).toBe(1);
  });

  it("groups stats by provider", async () => {
    await withTelemetry(
      { capability: "caption", provider: "openai", model: "gpt-4o", tier: "GRID", budgetExceeded: false },
      async () => "ok"
    );
    await withTelemetry(
      { capability: "image", provider: "fal", model: "fal-ai/flux/dev", tier: "SPARK", budgetExceeded: false },
      async () => "url"
    );

    const stats = getStats();
    expect(stats.byProvider["openai"].calls).toBe(1);
    expect(stats.byProvider["fal"].calls).toBe(1);
  });

  it("returns recent entries (last 20)", async () => {
    const ctx: TelemetryContext = {
      capability: "caption",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "SPARK",
      budgetExceeded: false,
    };

    for (let i = 0; i < 25; i++) {
      await withTelemetry(ctx, async () => "ok");
    }

    const stats = getStats();
    expect(stats.recentEntries).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// Budget enforcement (Phase 6)
// ---------------------------------------------------------------------------

describe("checkBudget", () => {
  it("returns not exceeded when no budget set", () => {
    const ctx: ToolContext = { tier: "GRID" };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(false);
    expect(result.percentUsed).toBe(0);
  });

  it("returns not exceeded when under limit", () => {
    const ctx: ToolContext = {
      tier: "GRID",
      budget: { dailyLimitCents: 1000, spentTodayCents: 500 },
    };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(false);
    expect(result.percentUsed).toBe(50);
  });

  it("returns exceeded when at limit", () => {
    const ctx: ToolContext = {
      tier: "GRID",
      budget: { dailyLimitCents: 1000, spentTodayCents: 1000 },
    };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(true);
    expect(result.percentUsed).toBe(100);
  });

  it("returns exceeded when over limit", () => {
    const ctx: ToolContext = {
      tier: "GRID",
      budget: { dailyLimitCents: 1000, spentTodayCents: 1500 },
    };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(true);
    expect(result.percentUsed).toBe(150);
  });

  it("returns not exceeded when dailyLimitCents is 0 (no limit)", () => {
    const ctx: ToolContext = {
      tier: "SPARK",
      budget: { dailyLimitCents: 0, spentTodayCents: 0 },
    };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(false);
  });

  it("defaults spentTodayCents to 0 when not provided", () => {
    const ctx: ToolContext = {
      tier: "GRID",
      budget: { dailyLimitCents: 1000 },
    };
    const result = checkBudget(ctx);
    expect(result.exceeded).toBe(false);
    expect(result.percentUsed).toBe(0);
  });
});
