// Bot Strategy — Phase 5
// Extracts learned preferences from post performance data and persists them
// as BotStrategy weights. The generation pipeline reads these weights to bias
// content decisions WITHOUT changing the bot's persona text.

import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategyWeights = {
  topicWeights: Record<string, number>;
  formatWeights: Record<string, number>;
  hookWeights: Record<string, number>;
  postRateBias: number;
  replyRateBias: number;
};

type ScoredPost = {
  content: string;
  type: string;
  tags: string[];
  videoDuration: number | null;
  score: number;
  likes: number;
  comments: number;
};

// ---------------------------------------------------------------------------
// Hook classification
// ---------------------------------------------------------------------------

// Classify the opening style of a caption into a hook category.
// These categories become learnable weights — the bot discovers which
// openings its audience responds to.
export function classifyHook(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "other";

  const firstChar = trimmed[0];
  const lowerStart = trimmed.slice(0, 60).toLowerCase();

  // Question hooks: "why do...", "what if...", "ever notice..."
  if (trimmed.includes("?") && trimmed.indexOf("?") < 80) return "question";

  // Exclamation hooks: "NO WAY!", "This is insane!"
  if (firstChar === "!" || (trimmed.includes("!") && trimmed.indexOf("!") < 40)) return "exclamation";

  // Hot take / opinion hooks: "honestly", "unpopular opinion", "hear me out"
  if (
    lowerStart.startsWith("honestly") ||
    lowerStart.startsWith("unpopular") ||
    lowerStart.startsWith("hot take") ||
    lowerStart.startsWith("hear me out") ||
    lowerStart.startsWith("ngl") ||
    lowerStart.startsWith("not gonna lie")
  ) return "hot_take";

  // Story hooks: "so I...", "yesterday...", "last night..."
  if (
    lowerStart.startsWith("so ") ||
    lowerStart.startsWith("yesterday") ||
    lowerStart.startsWith("last night") ||
    lowerStart.startsWith("today ") ||
    lowerStart.startsWith("this morning")
  ) return "story";

  // Observation hooks: "that moment when", "when you", "the way"
  if (
    lowerStart.startsWith("that moment") ||
    lowerStart.startsWith("the way ") ||
    lowerStart.startsWith("the thing about")
  ) return "observation";

  // Direct/declarative hooks: short punchy statements
  if (trimmed.length < 50 && !trimmed.includes("?") && !trimmed.includes("!")) return "punchy";

  return "statement";
}

// ---------------------------------------------------------------------------
// Weight extraction
// ---------------------------------------------------------------------------

/**
 * Extract topic weights from post tags.
 * Tags from top posts get positive weight, tags from bottom posts get negative weight.
 * The result is a map of tag → weight that captures what topics resonate.
 */
export function extractTopicWeights(
  topPosts: ScoredPost[],
  bottomPosts: ScoredPost[],
  existing: Record<string, number> = {}
): Record<string, number> {
  const weights = { ...existing };
  const decay = 0.8; // Decay old weights to allow adaptation

  // Decay existing weights
  for (const key of Object.keys(weights)) {
    weights[key] *= decay;
    if (Math.abs(weights[key]) < 0.05) delete weights[key];
  }

  // Boost tags from top-performing posts
  for (const post of topPosts) {
    for (const tag of post.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      weights[normalizedTag] = (weights[normalizedTag] || 0) + 0.3;
    }
  }

  // Penalize tags from bottom-performing posts
  for (const post of bottomPosts) {
    for (const tag of post.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      weights[normalizedTag] = (weights[normalizedTag] || 0) - 0.15;
    }
  }

  // Clamp weights to [-1, 1]
  for (const key of Object.keys(weights)) {
    weights[key] = Math.max(-1, Math.min(1, weights[key]));
  }

  return weights;
}

/**
 * Extract format weights from post type and engagement.
 * Tracks IMAGE vs VIDEO (by duration) performance.
 */
export function extractFormatWeights(
  topPosts: ScoredPost[],
  bottomPosts: ScoredPost[],
  existing: Record<string, number> = {}
): Record<string, number> {
  const weights = { ...existing };
  const decay = 0.85;

  // Decay existing
  for (const key of Object.keys(weights)) {
    weights[key] *= decay;
    if (Math.abs(weights[key]) < 0.05) delete weights[key];
  }

  function formatKey(post: ScoredPost): string {
    if (post.type === "VIDEO" && post.videoDuration) {
      return `VIDEO_${post.videoDuration}`;
    }
    return post.type;
  }

  // Boost formats from top posts
  for (const post of topPosts) {
    const key = formatKey(post);
    weights[key] = (weights[key] || 0) + 0.25;
  }

  // Penalize formats from bottom posts
  for (const post of bottomPosts) {
    const key = formatKey(post);
    weights[key] = (weights[key] || 0) - 0.1;
  }

  // Clamp
  for (const key of Object.keys(weights)) {
    weights[key] = Math.max(-1, Math.min(1, weights[key]));
  }

  return weights;
}

/**
 * Extract hook weights from caption opening patterns.
 * Classifies each caption's hook style and tracks which styles perform.
 */
export function extractHookWeights(
  topPosts: ScoredPost[],
  bottomPosts: ScoredPost[],
  existing: Record<string, number> = {}
): Record<string, number> {
  const weights = { ...existing };
  const decay = 0.85;

  for (const key of Object.keys(weights)) {
    weights[key] *= decay;
    if (Math.abs(weights[key]) < 0.05) delete weights[key];
  }

  for (const post of topPosts) {
    const hook = classifyHook(post.content);
    weights[hook] = (weights[hook] || 0) + 0.25;
  }

  for (const post of bottomPosts) {
    const hook = classifyHook(post.content);
    weights[hook] = (weights[hook] || 0) - 0.1;
  }

  for (const key of Object.keys(weights)) {
    weights[key] = Math.max(-1, Math.min(1, weights[key]));
  }

  return weights;
}

/**
 * Calculate posting rate bias from engagement trends.
 * If recent posts are getting high engagement → slight positive bias (post more).
 * If recent posts are underperforming → slight negative bias (post less, quality over quantity).
 */
export function calculatePostRateBias(
  avgEngagement: number,
  topAvgEngagement: number,
  existingBias: number = 0
): number {
  const ratio = topAvgEngagement > 0 ? avgEngagement / topAvgEngagement : 0.5;
  const nudge = ratio > 0.7 ? 0.1 : ratio < 0.3 ? -0.1 : 0;
  return Math.max(-1, Math.min(1, existingBias * 0.8 + nudge));
}

// ---------------------------------------------------------------------------
// Strategy update (called from learning loop)
// ---------------------------------------------------------------------------

/**
 * Update a bot's strategy based on post performance analysis.
 * Called after analyzeBotPerformance computes top/bottom posts.
 * Upserts the BotStrategy record with updated weights.
 */
export async function updateBotStrategy(
  botId: string,
  topPosts: ScoredPost[],
  bottomPosts: ScoredPost[],
  avgEngagement: number
): Promise<void> {
  // Load existing strategy (if any) to blend with new data
  const existing = await prisma.botStrategy.findUnique({
    where: { botId },
  });

  const prev: StrategyWeights = existing
    ? {
        topicWeights: (existing.topicWeights as Record<string, number>) || {},
        formatWeights: (existing.formatWeights as Record<string, number>) || {},
        hookWeights: (existing.hookWeights as Record<string, number>) || {},
        postRateBias: existing.postRateBias,
        replyRateBias: existing.replyRateBias,
      }
    : {
        topicWeights: {},
        formatWeights: {},
        hookWeights: {},
        postRateBias: 0,
        replyRateBias: 0,
      };

  const topAvg = topPosts.length > 0
    ? topPosts.reduce((s, p) => s + p.score, 0) / topPosts.length
    : 0;

  const topicWeights = extractTopicWeights(topPosts, bottomPosts, prev.topicWeights);
  const formatWeights = extractFormatWeights(topPosts, bottomPosts, prev.formatWeights);
  const hookWeights = extractHookWeights(topPosts, bottomPosts, prev.hookWeights);
  const postRateBias = calculatePostRateBias(avgEngagement, topAvg, prev.postRateBias);

  await prisma.botStrategy.upsert({
    where: { botId },
    update: {
      topicWeights,
      formatWeights,
      hookWeights,
      postRateBias,
    },
    create: {
      botId,
      topicWeights,
      formatWeights,
      hookWeights,
      postRateBias,
    },
  });
}

// ---------------------------------------------------------------------------
// Strategy reading (called from generation pipeline)
// ---------------------------------------------------------------------------

/**
 * Load a bot's learned strategy. Returns null if no strategy exists yet.
 */
export async function loadBotStrategy(
  botId: string
): Promise<StrategyWeights | null> {
  const strategy = await prisma.botStrategy.findUnique({
    where: { botId },
  });

  if (!strategy) return null;

  return {
    topicWeights: (strategy.topicWeights as Record<string, number>) || {},
    formatWeights: (strategy.formatWeights as Record<string, number>) || {},
    hookWeights: (strategy.hookWeights as Record<string, number>) || {},
    postRateBias: strategy.postRateBias,
    replyRateBias: strategy.replyRateBias,
  };
}

/**
 * Build a strategy context string for injection into the caption prompt.
 * Translates numeric weights into natural language hints.
 * The bot's persona is NOT changed — only content strategy is guided.
 */
export function buildStrategyContext(strategy: StrategyWeights): string {
  const parts: string[] = [];

  // Topic hints from learned weights
  const topTopics = Object.entries(strategy.topicWeights)
    .filter(([, w]) => w > 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  const avoidTopics = Object.entries(strategy.topicWeights)
    .filter(([, w]) => w < -0.1)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([t]) => t);

  if (topTopics.length > 0) {
    parts.push(`Topics your audience loves: ${topTopics.join(", ")}`);
  }
  if (avoidTopics.length > 0) {
    parts.push(`Topics that underperform: ${avoidTopics.join(", ")}`);
  }

  // Hook style hints
  const topHooks = Object.entries(strategy.hookWeights)
    .filter(([, w]) => w > 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topHooks.length > 0) {
    const hookDescriptions: Record<string, string> = {
      question: "asking questions",
      exclamation: "high-energy exclamations",
      hot_take: "hot takes and bold opinions",
      story: "personal stories and anecdotes",
      observation: "relatable observations",
      punchy: "short punchy statements",
      statement: "direct declarative statements",
    };
    const hookNames = topHooks
      .map(([h]) => hookDescriptions[h] || h)
      .join(", ");
    parts.push(`Opening styles that work for you: ${hookNames}`);
  }

  if (parts.length === 0) return "";

  return `\nSTRATEGY (learned from your post performance — lean into this):
${parts.map((p) => `- ${p}`).join("\n")}`;
}
