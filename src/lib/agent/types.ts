// Agent Loop types — Phase 3 + Alive Bots
// Defines the perception, decision, and action interfaces for the bot agent cycle.

import type { BotLifeState, MinimalEvent } from "../life/types";
import type { StoredMemory } from "../life/memory";

export type AgentAction =
  | "CREATE_POST"
  | "RESPOND_TO_COMMENT"
  | "RESPOND_TO_POST"
  | "IDLE";

export type AgentPriority = "high" | "medium" | "low";

/**
 * Everything the agent perceives about its world before making a decision.
 * Built by the perception module from DB queries — no AI calls.
 */
export type PerceptionContext = {
  bot: {
    id: string;
    name: string;
    handle: string;
    personality: string | null;
    niche: string | null;
    tone: string | null;
    postsPerDay: number;
    lastPostedAt: Date | null;
  };
  ownerTier: string;

  // Performance context (from learning loop)
  recentPostCount: number;
  avgEngagement: number;
  performanceContext: string; // pre-built prompt from learning loop

  // Social signals
  unansweredComments: UnansweredComment[];
  recentFeedPosts: FeedPost[];
  trendingTopics: string[];

  // Timing
  hoursSinceLastPost: number;
  postsToday: number;
  currentHour: number; // 0-23, for "waking hours" reasoning

  // Engagement tracking
  recentCommentCount: number; // Comments this bot made in the last 6 hours

  // Alive Bots — life state, recent events, and episodic memories
  lifeState?: BotLifeState;
  recentEvents?: MinimalEvent[];
  memories?: StoredMemory[];
};

export type UnansweredComment = {
  commentId: string;
  postId: string;
  postContent: string;
  commentContent: string;
  commentAuthor: string;
  ageMinutes: number;
};

export type FeedPost = {
  postId: string;
  botHandle: string;
  botName: string;
  content: string;
  likes: number;
  comments: number;
  ageHours: number;
};

/**
 * The agent's decision: what to do and why.
 * Returned by the decide module from a GPT-4o call.
 */
export type AgentDecision = {
  action: AgentAction;
  reasoning: string;
  priority: AgentPriority;
  // Target ID for RESPOND actions (commentId or postId)
  targetId?: string;
  // Optional context hint passed to the action handler
  contextHint?: string;
};

/**
 * The result of running a full agent cycle (perceive → decide → act).
 */
export type AgentCycleResult = {
  botId: string;
  action: AgentAction;
  reasoning: string;
  enqueuedJobId?: string;
  nextCycleAt: Date;
};
