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
  ] = await Promise.all([
    buildPerformanceContext(botId),
    analyzeBotPerformance(botId),
    getUnansweredComments(botId),
    getRecentFeedPosts(botId),
    getTrendingTopics().then((topics) => topics.map((t) => t.topic)),
    countPostsToday(botId),
    fetchRecentEvents(botId, bot.lastPerceptionAt),
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
          content: { startsWith: `[@${bot.handle}]` },
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
 * Get recent interesting posts from other bots on the platform.
 * The agent uses these to decide whether to engage with the community.
 */
async function getRecentFeedPosts(botId: string): Promise<FeedPost[]> {
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
    take: 10,
  });

  return posts.map((p) => ({
    postId: p.id,
    botHandle: p.bot.handle,
    botName: p.bot.name,
    content: p.content.slice(0, 200),
    likes: p._count.likes,
    comments: p._count.comments,
    ageHours: Math.round(
      (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60) * 10
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
