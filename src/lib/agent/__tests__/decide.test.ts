import { describe, it, expect } from "vitest";
import { fallbackDecision, buildDecisionPrompt } from "../decide";
import type { PerceptionContext } from "../types";

function makeContext(overrides: Partial<PerceptionContext> = {}): PerceptionContext {
  return {
    bot: {
      id: "bot-1",
      name: "TestBot",
      handle: "testbot",
      personality: "witty and sarcastic",
      niche: "tech",
      tone: "casual",
      postsPerDay: 2,
      lastPostedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6h ago
    },
    ownerTier: "PULSE",
    recentPostCount: 10,
    avgEngagement: 5.2,
    performanceContext: "",
    unansweredComments: [],
    recentFeedPosts: [],
    trendingTopics: [],
    hoursSinceLastPost: 6,
    postsToday: 0,
    currentHour: 14, // 2pm
    recentCommentCount: 0,
    ...overrides,
  };
}

describe("fallbackDecision", () => {
  it("returns IDLE outside posting hours (late night)", () => {
    const ctx = makeContext({ currentHour: 23 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("IDLE");
    expect(decision.reasoning).toContain("posting hours");
  });

  it("returns IDLE outside posting hours (early morning)", () => {
    const ctx = makeContext({ currentHour: 5 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("IDLE");
  });

  it("returns IDLE when daily limit reached and no comments", () => {
    const ctx = makeContext({ postsToday: 2 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("IDLE");
    expect(decision.reasoning).toContain("limit");
  });

  it("returns RESPOND_TO_COMMENT when limit reached but has comments", () => {
    const ctx = makeContext({
      postsToday: 2,
      unansweredComments: [
        {
          commentId: "c1",
          postId: "p1",
          postContent: "My post",
          commentContent: "Great post!",
          commentAuthor: "fan1",
          ageMinutes: 30,
        },
      ],
    });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("RESPOND_TO_COMMENT");
    expect(decision.targetId).toBe("c1");
  });

  it("prioritizes RESPOND_TO_COMMENT over posting when recent post exists", () => {
    const ctx = makeContext({
      hoursSinceLastPost: 2, // recently posted
      unansweredComments: [
        {
          commentId: "c2",
          postId: "p2",
          postContent: "Another post",
          commentContent: "Love this!",
          commentAuthor: "fan2",
          ageMinutes: 15,
        },
      ],
    });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("RESPOND_TO_COMMENT");
  });

  it("returns CREATE_POST when enough time has passed", () => {
    const ctx = makeContext({ hoursSinceLastPost: 6 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("CREATE_POST");
  });

  it("returns high priority CREATE_POST when 8+ hours since last post", () => {
    const ctx = makeContext({ hoursSinceLastPost: 10 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("CREATE_POST");
    expect(decision.priority).toBe("high");
  });

  it("returns high priority CREATE_POST for first-ever post", () => {
    const ctx = makeContext({
      hoursSinceLastPost: 999,
      bot: {
        ...makeContext().bot,
        lastPostedAt: null,
      },
    });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("CREATE_POST");
    expect(decision.reasoning).toContain("First");
  });

  it("returns IDLE when nothing compelling to do", () => {
    const ctx = makeContext({ hoursSinceLastPost: 2 });
    const decision = fallbackDecision(ctx);
    expect(decision.action).toBe("IDLE");
  });
});

describe("buildDecisionPrompt", () => {
  it("includes bot identity", () => {
    const ctx = makeContext();
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain("@testbot");
    expect(prompt).toContain("TestBot");
    expect(prompt).toContain("witty and sarcastic");
  });

  it("includes timing info", () => {
    const ctx = makeContext();
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain("Hours since last post:");
    expect(prompt).toContain("Posts today: 0 / 2");
  });

  it("includes unanswered comments when present", () => {
    const ctx = makeContext({
      unansweredComments: [
        {
          commentId: "c1",
          postId: "p1",
          postContent: "My amazing post about tech",
          commentContent: "This is so insightful!",
          commentAuthor: "reader42",
          ageMinutes: 45,
        },
      ],
    });
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain("UNANSWERED COMMENTS");
    expect(prompt).toContain("reader42");
    expect(prompt).toContain("insightful");
  });

  it("includes feed posts when present", () => {
    const ctx = makeContext({
      recentFeedPosts: [
        {
          postId: "fp1",
          botHandle: "coolbot",
          botName: "CoolBot",
          content: "Hot take on AI",
          likes: 42,
          comments: 7,
          ageHours: 2,
          alreadyLiked: false,
        },
      ],
    });
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain("INTERESTING POSTS");
    expect(prompt).toContain("@coolbot");
  });

  it("includes trending topics when present", () => {
    const ctx = makeContext({ trendingTopics: ["ai", "robots", "future"] });
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain("TRENDING TOPICS");
    expect(prompt).toContain("ai, robots, future");
  });

  it("includes JSON schema for output", () => {
    const ctx = makeContext();
    const prompt = buildDecisionPrompt(ctx);
    expect(prompt).toContain('"action"');
    expect(prompt).toContain("CREATE_POST");
    expect(prompt).toContain("RESPOND_TO_COMMENT");
    expect(prompt).toContain("IDLE");
  });
});
