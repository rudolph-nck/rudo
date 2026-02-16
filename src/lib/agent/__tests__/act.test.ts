import { describe, it, expect } from "vitest";
import { calculateNextCycle } from "../act";
import type { AgentDecision } from "../types";

describe("calculateNextCycle", () => {
  it("returns a future date", () => {
    const decision: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Time to post",
      priority: "medium",
    };
    const next = calculateNextCycle(decision, 15);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });

  it("high priority = shorter cooldown", () => {
    const high: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Urgent",
      priority: "high",
    };
    const medium: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Normal",
      priority: "medium",
    };

    // Run many times and compare averages to handle jitter
    const highTimes: number[] = [];
    const mediumTimes: number[] = [];

    for (let i = 0; i < 100; i++) {
      highTimes.push(calculateNextCycle(high, 15).getTime() - Date.now());
      mediumTimes.push(calculateNextCycle(medium, 15).getTime() - Date.now());
    }

    const avgHigh = highTimes.reduce((a, b) => a + b, 0) / highTimes.length;
    const avgMedium = mediumTimes.reduce((a, b) => a + b, 0) / mediumTimes.length;

    // High priority should be roughly 50% of medium (0.5x vs 1.0x multiplier)
    expect(avgHigh).toBeLessThan(avgMedium);
  });

  it("low priority = longer cooldown", () => {
    const low: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Not urgent",
      priority: "low",
    };
    const medium: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Normal",
      priority: "medium",
    };

    const lowTimes: number[] = [];
    const mediumTimes: number[] = [];

    for (let i = 0; i < 100; i++) {
      lowTimes.push(calculateNextCycle(low, 15).getTime() - Date.now());
      mediumTimes.push(calculateNextCycle(medium, 15).getTime() - Date.now());
    }

    const avgLow = lowTimes.reduce((a, b) => a + b, 0) / lowTimes.length;
    const avgMedium = mediumTimes.reduce((a, b) => a + b, 0) / mediumTimes.length;

    expect(avgLow).toBeGreaterThan(avgMedium);
  });

  it("IDLE action gets extra cooldown", () => {
    const idle: AgentDecision = {
      action: "IDLE",
      reasoning: "Nothing to do",
      priority: "medium",
    };
    const post: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Post time",
      priority: "medium",
    };

    const idleTimes: number[] = [];
    const postTimes: number[] = [];

    for (let i = 0; i < 100; i++) {
      idleTimes.push(calculateNextCycle(idle, 15).getTime() - Date.now());
      postTimes.push(calculateNextCycle(post, 15).getTime() - Date.now());
    }

    const avgIdle = idleTimes.reduce((a, b) => a + b, 0) / idleTimes.length;
    const avgPost = postTimes.reduce((a, b) => a + b, 0) / postTimes.length;

    // IDLE should wait 1.5x longer
    expect(avgIdle).toBeGreaterThan(avgPost);
  });

  it("uses the provided cooldown minutes as baseline", () => {
    const decision: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Post time",
      priority: "medium", // 1.0x multiplier
    };

    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      times.push(calculateNextCycle(decision, 30).getTime() - Date.now());
    }

    const avgMinutes = times.reduce((a, b) => a + b, 0) / times.length / 60000;

    // With 1.0x multiplier and 20% jitter, should average close to 30 minutes
    expect(avgMinutes).toBeGreaterThan(25);
    expect(avgMinutes).toBeLessThan(35);
  });
});
