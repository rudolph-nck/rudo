import { describe, it, expect } from "vitest";
import type {
  AgentAction,
  AgentPriority,
  AgentDecision,
  PerceptionContext,
  AgentCycleResult,
} from "../types";

describe("Agent types", () => {
  it("AgentAction covers all valid actions", () => {
    const actions: AgentAction[] = [
      "CREATE_POST",
      "RESPOND_TO_COMMENT",
      "RESPOND_TO_POST",
      "IDLE",
    ];
    expect(actions).toHaveLength(4);
  });

  it("AgentPriority covers all valid levels", () => {
    const priorities: AgentPriority[] = ["high", "medium", "low"];
    expect(priorities).toHaveLength(3);
  });

  it("AgentDecision can be constructed", () => {
    const decision: AgentDecision = {
      action: "CREATE_POST",
      reasoning: "Time to post",
      priority: "high",
    };
    expect(decision.action).toBe("CREATE_POST");
    expect(decision.targetId).toBeUndefined();
  });

  it("AgentDecision supports targetId for RESPOND actions", () => {
    const decision: AgentDecision = {
      action: "RESPOND_TO_COMMENT",
      reasoning: "Fan engagement",
      priority: "medium",
      targetId: "comment-123",
      contextHint: "They asked about our niche",
    };
    expect(decision.targetId).toBe("comment-123");
    expect(decision.contextHint).toBeDefined();
  });

  it("AgentCycleResult captures the full cycle outcome", () => {
    const result: AgentCycleResult = {
      botId: "bot-1",
      action: "CREATE_POST",
      reasoning: "First post",
      enqueuedJobId: "job-1",
      nextCycleAt: new Date(),
    };
    expect(result.botId).toBe("bot-1");
    expect(result.enqueuedJobId).toBeDefined();
  });

  it("PerceptionContext can represent a new bot", () => {
    const ctx: PerceptionContext = {
      bot: {
        id: "bot-new",
        name: "NewBot",
        handle: "newbot",
        personality: null,
        niche: null,
        tone: null,
        postsPerDay: 2,
        lastPostedAt: null,
      },
      ownerTier: "SPARK",
      recentPostCount: 0,
      avgEngagement: 0,
      performanceContext: "",
      unansweredComments: [],
      recentFeedPosts: [],
      trendingTopics: [],
      hoursSinceLastPost: 999,
      postsToday: 0,
      currentHour: 12,
    };
    expect(ctx.hoursSinceLastPost).toBe(999);
    expect(ctx.bot.lastPostedAt).toBeNull();
  });
});
