// Agent Perception Module — Phase 3 + Alive Bots
// Gathers all context the agent needs to make a decision.
// Now also loads/updates life state and retrieves episodic memories.

import { prisma } from "../prisma";
import { buildPerformanceContext, analyzeBotPerformance } from "../learning-loop";
import { getTrendingTopics } from "../trending";
import { initLifeState } from "../life/init";
import { updateLifeState } from "../life/update";
import { writeMemories, getRelevantMemories } from "../life/memory";
import type { BotLifeState, MinimalEvent } from "../life/types";
import type { PerceptionContext, UnansweredComment, FeedPost } from "./types";

/**
 * Build the full perception context for a bot.
 * This is the "eyes and ears" of the agent — everything it knows before deciding.
 * Now also loads/updates life state and retrieves episodic memories.
 */
export async function perceive(botId: string): Promise<PerceptionContext> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { owner: { select: { tier: true } } },
  });

  if (!bot) throw new Error(`Bot ${botId} not found`);

  // Run independent queries concurrently
  const [
    performanceContext,
    performance,
    unansweredComments,
    recentFeedPosts,
    trendingTopics,
    postsToday,
    recentEvents,
    recentCommentCount,
  ] = await Promise.all([
    buildPerformanceContext(botId),
    analyzeBotPerformance(botId),
    getUnansweredComments(botId),
    getRecentFeedPosts(botId),
    getTrendingTopics().then((topics) => topics.map((t) => t.topic)),
    countPostsToday(botId),
    fetchRecentEvents(botId, bot.lastPerceptionAt),
    countRecentComments(botId),
  ]);

  const hoursSinceLastPost = bot.lastPostedAt
    ? (Date.now() - bot.lastPostedAt.getTime()) / (1000 * 60 * 60)
    : 999; // never posted = high urgency

  // --- Alive Bots: load + update life state ---
  let lifeState: BotLifeState | undefined;
  let memories: PerceptionContext["memories"];

  try {
    const currentLifeState = (bot.lifeState as BotLifeState | null) ?? initLifeState();

    // Load brain for emotion mapping (non-critical)
    let brain;
    try {
      const { ensureBrain } = await import("../brain/ensure");
      brain = await ensureBrain(botId);
    } catch { /* non-critical */ }

    // Deterministic update
    const { nextState, memories: newMemories } = updateLifeState(currentLifeState, {
      events: recentEvents,
      hoursSinceLastPost,
      postsToday,
      unansweredCommentsCount: unansweredComments.length,
      trendingTopics,
      avgEngagement: performance?.avgEngagement ?? 0,
      brain,
    });

    lifeState = nextState;

    // Persist updated state + write new memories
    await prisma.bot.update({
      where: { id: botId },
      data: {
        lifeState: nextState as any,
        lifeStateUpdatedAt: new Date(),
        lastPerceptionAt: new Date(),
      },
    });

    if (newMemories.length > 0) {
      await writeMemories(botId, newMemories);
    }

    // Retrieve relevant memories using current context tags
    const queryTags = [
      ...trendingTopics.slice(0, 3),
      nextState.affect.emotion,
      ...(unansweredComments.length > 0 ? ["social", "comments"] : []),
      ...(hoursSinceLastPost > 8 ? ["creative", "posting"] : []),
    ];
    memories = await getRelevantMemories(botId, queryTags, 5);
  } catch {
    // Non-critical — perception works without life state
  }

  return {
    bot: {
      id: bot.id,
      name: bot.name,
      handle: bot.handle,
      personality: bot.personality,
      niche: bot.niche,
      tone: bot.tone,
      postsPerDay: bot.postsPerDay,
      lastPostedAt: bot.lastPostedAt,
    },
    ownerTier: bot.owner.tier,
    recentPostCount: performance ? 50 : 0, // analyzeBotPerformance pulls last 50
    avgEngagement: performance?.avgEngagement ?? 0,
    performanceContext,
    unansweredComments,
    recentFeedPosts,
    trendingTopics,
    hoursSinceLastPost,
    postsToday,
    currentHour: new Date().getHours(),
    recentCommentCount,
    lifeState,
    recentEvents,
    memories,
  };
}

/**
 * Fetch BotEvents since the last perception (max 50).
 */
async function fetchRecentEvents(
  botId: string,
  since: Date | null,
): Promise<MinimalEvent[]> {
  try {
    const events = await prisma.botEvent.findMany({
      where: {
        botId,
        createdAt: since ? { gt: since } : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        actorId: true,
        targetId: true,
        tags: true,
        sentiment: true,
        payload: true,
        createdAt: true,
      },
    });
    return events.map((e) => ({
      ...e,
      payload: (e.payload as Record<string, unknown>) ?? {},
    }));
  } catch {
    return []; // Graceful degradation
  }
}

/**
 * Find comments on this bot's posts that haven't been replied to by the bot's owner.
 * These are social signals the agent should respond to.
 */
async function getUnansweredComments(botId: string): Promise<UnansweredComment[]> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { ownerId: true, handle: true },
  });
  if (!bot) return [];

  // Get recent comments on the bot's posts (last 24 hours)
  const comments = await prisma.comment.findMany({
    where: {
      post: { botId },
      userId: { not: bot.ownerId }, // Not from the bot's owner
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: {
      post: { select: { id: true, content: true } },
      user: { select: { name: true, handle: true } },
      replies: {
        where: {
          botId: botId,
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Filter to only unanswered comments (no reply from this bot)
  return comments
    .filter((c) => c.replies.length === 0)
    .map((c) => ({
      commentId: c.id,
      postId: c.post.id,
      postContent: c.post.content.slice(0, 200),
      commentContent: c.content.slice(0, 200),
      commentAuthor: c.user.handle || c.user.name || "unknown",
      ageMinutes: Math.round(
        (Date.now() - c.createdAt.getTime()) / (1000 * 60)
      ),
    }));
}

/**
 * Score how relevant a post's content is to a bot's niche/interests.
 * Returns 0-1 where 0 = completely irrelevant, 1 = highly relevant.
 * Posts below the threshold get filtered out — a yoga bot won't see gun posts.
 */
function scoreNicheRelevance(postContent: string, botNiche: string | null): number {
  // No niche = interested in everything
  if (!botNiche) return 0.5;

  const content = postContent.toLowerCase();
  const nicheTokens = botNiche.toLowerCase().split(/[\s,/]+/).filter(Boolean);

  if (nicheTokens.length === 0) return 0.5;

  // Check direct keyword overlap
  let matchCount = 0;
  for (const token of nicheTokens) {
    if (content.includes(token)) matchCount++;
  }

  if (matchCount > 0) {
    // Direct niche match — highly relevant
    return 0.6 + (matchCount / nicheTokens.length) * 0.4;
  }

  // Check for related-topic clusters (soft associations)
  const TOPIC_CLUSTERS: Record<string, string[]> = {
    fitness: ["workout", "gym", "exercise", "train", "cardio", "muscle", "strength", "health", "run", "lift", "gains", "body"],
    tech: ["code", "software", "app", "startup", "ai", "build", "developer", "programming", "data", "api"],
    food: ["cook", "recipe", "eat", "restaurant", "meal", "kitchen", "chef", "bake", "taste", "flavor", "hungry"],
    gaming: ["game", "play", "stream", "console", "pc", "rpg", "fps", "esports", "controller", "level"],
    music: ["song", "album", "artist", "beat", "listen", "concert", "genre", "playlist", "band", "producer"],
    fashion: ["outfit", "style", "wear", "brand", "look", "trend", "dress", "designer", "wardrobe"],
    art: ["paint", "draw", "create", "gallery", "visual", "color", "design", "sculpture", "canvas"],
    crypto: ["bitcoin", "blockchain", "token", "defi", "web3", "wallet", "nft", "mining"],
    finance: ["money", "invest", "stock", "market", "save", "budget", "wealth", "portfolio"],
    travel: ["trip", "explore", "destination", "flight", "hotel", "adventure", "country", "city"],
    photography: ["photo", "camera", "shot", "lens", "portrait", "exposure", "edit"],
    yoga: ["meditation", "mindful", "stretch", "breath", "practice", "zen", "calm", "peace"],
    comedy: ["funny", "joke", "laugh", "hilarious", "humor", "comedy", "standup"],
  };

  // Check if any niche token has a topic cluster, and score against content
  let clusterScore = 0;
  for (const token of nicheTokens) {
    const cluster = TOPIC_CLUSTERS[token];
    if (cluster) {
      let clusterMatches = 0;
      for (const word of cluster) {
        if (content.includes(word)) clusterMatches++;
      }
      if (clusterMatches > 0) {
        clusterScore = Math.max(clusterScore, 0.3 + Math.min(0.3, clusterMatches * 0.1));
      }
    }
  }

  if (clusterScore > 0) return clusterScore;

  // No match at all — generic content, mildly relevant (universal topics like moods, life)
  // Short posts or vibe posts are broadly relevant
  if (postContent.length < 50) return 0.35;

  return 0.25;
}

/** Minimum relevance score for a post to appear in a bot's feed */
const FEED_RELEVANCE_THRESHOLD = 0.2;

/**
 * Get recent interesting posts from other bots on the platform.
 * The agent uses these to decide whether to engage with the community.
 * v3: Filters by niche relevance — bots only see posts that make sense for them.
 */
async function getRecentFeedPosts(botId: string): Promise<FeedPost[]> {
  // Fetch the bot's niche for relevance scoring
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { niche: true },
  });

  const posts = await prisma.post.findMany({
    where: {
      botId: { not: botId },
      moderationStatus: "APPROVED",
      bot: { deactivatedAt: null },
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    },
    include: {
      bot: { select: { handle: true, name: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { engagementScore: "desc" },
    take: 20, // Fetch more, then filter by relevance
  });

  // Score and filter by niche relevance
  const scored = posts
    .map((p) => ({
      post: p,
      relevance: scoreNicheRelevance(p.content, bot?.niche ?? null),
    }))
    .filter((s) => s.relevance >= FEED_RELEVANCE_THRESHOLD)
    // Sort by relevance * engagement for best match
    .sort((a, b) => {
      const aScore = a.relevance * (1 + a.post._count.likes + a.post._count.comments);
      const bScore = b.relevance * (1 + b.post._count.likes + b.post._count.comments);
      return bScore - aScore;
    })
    .slice(0, 10);

  return scored.map((s) => ({
    postId: s.post.id,
    botHandle: s.post.bot.handle,
    botName: s.post.bot.name,
    content: s.post.content.slice(0, 200),
    likes: s.post._count.likes,
    comments: s.post._count.comments,
    ageHours: Math.round(
      (Date.now() - s.post.createdAt.getTime()) / (1000 * 60 * 60) * 10
    ) / 10,
  }));
}

/**
 * Count how many posts a bot has made today.
 */
async function countPostsToday(botId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.post.count({
    where: { botId, createdAt: { gte: today } },
  });
}

/**
 * Count how many comments this bot has made in the last 6 hours.
 * Used for engagement throttling — bots shouldn't comment on every post.
 */
async function countRecentComments(botId: string): Promise<number> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return prisma.comment.count({
    where: { botId, createdAt: { gte: sixHoursAgo } },
  });
}
