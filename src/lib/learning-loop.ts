// Bot Learning Loop
// Analyzes a bot's post performance history and generates insights
// that get injected into the AI generation prompt to improve content.
//
// Phase 5: After computing top/bottom posts, also updates BotStrategy
// weights so the generation pipeline can make data-driven decisions
// about format, topics, and hooks — without changing the bot's persona.

import { prisma } from "./prisma";
import { updateBotStrategy } from "./strategy";

type PerformanceInsight = {
  topPerformingThemes: string[];
  worstPerformingThemes: string[];
  avgEngagement: number;
  audiencePreferences: string;
  contentAdvice: string;
};

/**
 * Analyze a bot's historical post performance to extract learning insights.
 * Looks at likes, comments, views to find what resonates with the audience.
 */
export async function analyzeBotPerformance(
  botId: string
): Promise<PerformanceInsight | null> {
  // Get all approved posts with engagement data (last 30 days)
  const posts = await prisma.post.findMany({
    where: {
      botId,
      moderationStatus: "APPROVED",
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Need at least 5 posts to have meaningful data
  if (posts.length < 5) return null;

  // Score each post by engagement
  const scored = posts.map((p) => ({
    content: p.content,
    type: p.type,
    tags: p.tags || [],
    videoDuration: p.videoDuration,
    score: p._count.likes + p._count.comments * 2.5 + p.viewCount * 0.01,
    likes: p._count.likes,
    comments: p._count.comments,
    views: p.viewCount,
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  const avgEngagement =
    scored.reduce((sum, p) => sum + p.score, 0) / scored.length;

  // Top 20% and bottom 20%
  const topCount = Math.max(2, Math.floor(scored.length * 0.2));
  const topPosts = scored.slice(0, topCount);
  const bottomPosts = scored.slice(-topCount);

  // Phase 5: Update BotStrategy weights from performance data
  try {
    await updateBotStrategy(botId, topPosts, bottomPosts, avgEngagement);
  } catch {
    // Non-critical — strategy update failure shouldn't block generation
  }

  // Extract content snippets for the prompt
  const topPerformingThemes = topPosts.map(
    (p) => p.content.slice(0, 120)
  );
  const worstPerformingThemes = bottomPosts.map(
    (p) => p.content.slice(0, 120)
  );

  // Analyze engagement patterns
  const topAvgLikes =
    topPosts.reduce((s, p) => s + p.likes, 0) / topPosts.length;
  const topAvgComments =
    topPosts.reduce((s, p) => s + p.comments, 0) / topPosts.length;
  const bottomAvgLikes =
    bottomPosts.reduce((s, p) => s + p.likes, 0) / bottomPosts.length;

  // Determine what the audience prefers
  const commentHeavy = topAvgComments > topAvgLikes * 0.3;
  const likeHeavy = topAvgLikes > topAvgComments * 5;

  let audiencePreferences = "";
  if (commentHeavy) {
    audiencePreferences =
      "Your audience loves content that sparks discussion and debate. They comment heavily on thought-provoking posts.";
  } else if (likeHeavy) {
    audiencePreferences =
      "Your audience prefers quick, punchy content they can like and move on. Keep it sharp and immediate.";
  } else {
    audiencePreferences =
      "Your audience engages with a mix of quick reactions and deeper discussions. Balance both.";
  }

  // Generate content advice based on the performance gap
  const performanceGap = topPosts[0].score / Math.max(bottomPosts[0].score, 0.1);
  let contentAdvice = "";
  if (performanceGap > 5) {
    contentAdvice =
      "There is a BIG difference between your best and worst posts. Focus heavily on the style and themes of your top-performing content.";
  } else if (performanceGap > 2) {
    contentAdvice =
      "Some topics clearly resonate more than others. Lean into what works while occasionally experimenting.";
  } else {
    contentAdvice =
      "Your engagement is fairly consistent. Try pushing creative boundaries to find breakthrough content.";
  }

  return {
    topPerformingThemes,
    worstPerformingThemes,
    avgEngagement,
    audiencePreferences,
    contentAdvice,
  };
}

/**
 * Build a performance context string that gets injected into the AI
 * generation prompt. This is the learning loop — the bot gets smarter
 * about what its audience wants over time.
 */
export async function buildPerformanceContext(
  botId: string
): Promise<string> {
  const insights = await analyzeBotPerformance(botId);

  if (!insights) {
    return ""; // Not enough data yet
  }

  return `
PERFORMANCE INTELLIGENCE (use this to guide your content strategy):

${insights.contentAdvice}

${insights.audiencePreferences}

Your TOP-PERFORMING posts (create more content like this):
${insights.topPerformingThemes.map((t) => `- "${t}"`).join("\n")}

Your WORST-PERFORMING posts (avoid this style):
${insights.worstPerformingThemes.map((t) => `- "${t}"`).join("\n")}

Average engagement score: ${insights.avgEngagement.toFixed(1)}. Try to beat it.`;
}

/**
 * Get a summary of performance stats for the dashboard.
 */
export async function getPerformanceSummary(botId: string) {
  const posts = await prisma.post.findMany({
    where: {
      botId,
      moderationStatus: "APPROVED",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (posts.length === 0) {
    return {
      postsThisWeek: 0,
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      avgEngagementRate: 0,
      trend: "neutral" as const,
    };
  }

  const totalLikes = posts.reduce((s, p) => s + p._count.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p._count.comments, 0);
  const totalViews = posts.reduce((s, p) => s + p.viewCount, 0);
  const avgEngagementRate =
    totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  // Compare to previous week
  const prevPosts = await prisma.post.findMany({
    where: {
      botId,
      moderationStatus: "APPROVED",
      createdAt: {
        gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
  });

  const prevLikes = prevPosts.reduce((s, p) => s + p._count.likes, 0);
  const prevComments = prevPosts.reduce((s, p) => s + p._count.comments, 0);
  const prevTotal = prevLikes + prevComments;
  const currentTotal = totalLikes + totalComments;

  const trend =
    currentTotal > prevTotal * 1.1
      ? ("up" as const)
      : currentTotal < prevTotal * 0.9
        ? ("down" as const)
        : ("neutral" as const);

  return {
    postsThisWeek: posts.length,
    totalLikes,
    totalComments,
    totalViews,
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    trend,
  };
}
