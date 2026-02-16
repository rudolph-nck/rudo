// Generation telemetry — logs provider usage, duration, success/failure, and estimated cost.
// Phase 6: Reliability + Cost Safety
//
// Every AI provider call is wrapped with telemetry via `withTelemetry()`.
// Entries are stored in-memory (ring buffer) for the /health/generation endpoint
// and logged to stdout for external log aggregation.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TelemetryEntry = {
  id: string;
  timestamp: string;
  capability: "caption" | "chat" | "image" | "video" | "vision";
  provider: string;
  model: string;
  tier: string;
  durationMs: number;
  success: boolean;
  error?: string;
  estimatedCostCents: number;
  budgetExceeded: boolean;
};

export type TelemetryStats = {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  totalEstimatedCostCents: number;
  byProvider: Record<string, { calls: number; failures: number; avgMs: number }>;
  recentEntries: TelemetryEntry[];
};

// ---------------------------------------------------------------------------
// Cost estimation (approximate per-call costs in cents)
// ---------------------------------------------------------------------------

const COST_TABLE: Record<string, number> = {
  // OpenAI chat (per call estimate based on ~500 tokens avg)
  "gpt-4o": 1.5,
  "gpt-4o-mini": 0.15,
  // fal.ai image
  "fal-ai/flux/dev": 3.0,
  "fal-ai/flux-general": 4.0,
  // fal.ai video
  "fal-ai/kling-video/v2/master/text-to-video": 15.0,
  "fal-ai/minimax-video/video-01/text-to-video": 20.0,
  // Runway
  "gen3a_turbo": 50.0,
};

export function estimateCostCents(model: string): number {
  return COST_TABLE[model] ?? 1.0;
}

// ---------------------------------------------------------------------------
// In-memory ring buffer (last 200 entries)
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 200;
const entries: TelemetryEntry[] = [];
let idCounter = 0;

export function getEntries(): readonly TelemetryEntry[] {
  return entries;
}

export function clearEntries(): void {
  entries.length = 0;
}

function pushEntry(entry: TelemetryEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

// ---------------------------------------------------------------------------
// Telemetry wrapper
// ---------------------------------------------------------------------------

export type TelemetryContext = {
  capability: TelemetryEntry["capability"];
  provider: string;
  model: string;
  tier: string;
  budgetExceeded: boolean;
};

/**
 * Wrap an AI provider call with telemetry logging.
 * Records duration, success/failure, and estimated cost.
 */
export async function withTelemetry<T>(
  ctx: TelemetryContext,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  let success = true;
  let error: string | undefined;

  try {
    const result = await fn();
    // Treat null results from image/video as failures
    if (result === null && (ctx.capability === "image" || ctx.capability === "video")) {
      success = false;
      error = "Provider returned null";
    }
    return result;
  } catch (err: any) {
    success = false;
    error = err.message || "Unknown error";
    throw err;
  } finally {
    const durationMs = Date.now() - start;
    const estimatedCostCents = success ? estimateCostCents(ctx.model) : 0;

    const entry: TelemetryEntry = {
      id: `tel_${++idCounter}`,
      timestamp: new Date().toISOString(),
      capability: ctx.capability,
      provider: ctx.provider,
      model: ctx.model,
      tier: ctx.tier,
      durationMs,
      success,
      error,
      estimatedCostCents,
      budgetExceeded: ctx.budgetExceeded,
    };

    pushEntry(entry);

    // Structured log for external aggregation
    console.log(
      JSON.stringify({
        event: "generation_telemetry",
        ...entry,
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Stats aggregation (for /health/generation endpoint)
// ---------------------------------------------------------------------------

export function getStats(): TelemetryStats {
  const total = entries.length;
  const successes = entries.filter((e) => e.success).length;
  const failures = total - successes;
  const avgMs = total > 0 ? Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / total) : 0;
  const totalCost = entries.reduce((s, e) => s + e.estimatedCostCents, 0);

  const byProvider: TelemetryStats["byProvider"] = {};
  for (const e of entries) {
    if (!byProvider[e.provider]) {
      byProvider[e.provider] = { calls: 0, failures: 0, avgMs: 0 };
    }
    byProvider[e.provider].calls++;
    if (!e.success) byProvider[e.provider].failures++;
    byProvider[e.provider].avgMs += e.durationMs;
  }
  for (const key of Object.keys(byProvider)) {
    byProvider[key].avgMs = Math.round(byProvider[key].avgMs / byProvider[key].calls);
  }

  // Return last 20 entries for the health endpoint
  const recentEntries = entries.slice(-20);

  return {
    totalCalls: total,
    successCount: successes,
    failureCount: failures,
    avgDurationMs: avgMs,
    totalEstimatedCostCents: Math.round(totalCost * 100) / 100,
    byProvider,
    recentEntries,
  };
}
