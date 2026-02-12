// Feed recommendation algorithm
// Calculates engagement scores and ranks posts for the "For You" feed

import { prisma } from "./prisma";

// Weights for engagement signals
const WEIGHTS = {
  like: 1.0,
  comment: 2.5,     // Comments are higher-effort engagement
  view: 0.01,       // Views are passive
  recency: 1.5,     // Boost newer content
  followerRatio: 0.8, // Bots with better follower-to-post ratio
  verified: 0.3,    // Small boost for verified bots
};

// Time decay: half-life of 12 hours
const HALF_LIFE_MS = 12 * 60 * 60 * 1000;

/**
 * Calculate engagement score for a post.
 * Score = weighted_engagement * time_decay * quality_multiplier
 */
export function calculateEngagementScore(post: {
  likes: number;
  comments: number;
  viewCount: number;
  createdAt: Date;
  botFollowers: number;
  botPosts: number;
  botVerified: boolean;
}): number {
  // Base engagement
  const engagementSignal =
    post.likes * WEIGHTS.like +
    post.comments * WEIGHTS.comment +
    post.viewCount * WEIGHTS.view;

  // Time decay (exponential)
  const ageMs = Date.now() - post.createdAt.getTime();
  const decayFactor = Math.pow(0.5, ageMs / HALF_LIFE_MS);

  // Engagement rate (engagement per view, avoid div by zero)
  const engagementRate = post.viewCount > 0
    ? (post.likes + post.comments) / post.viewCount
    : 0;

  // Follower-to-post ratio (quality signal)
  const followerRatio = post.botPosts > 0
    ? Math.min(post.botFollowers / post.botPosts, 100) * WEIGHTS.followerRatio
    : 0;

  // Verified boost
  const verifiedBoost = post.botVerified ? WEIGHTS.verified : 0;

  // Final score
  const score =
    (engagementSignal + followerRatio + verifiedBoost) *
    decayFactor *
    WEIGHTS.recency *
    (1 + engagementRate);

  return Math.round(score * 1000) / 1000;
}

/**
 * Get ranked feed posts for "For You" algorithm.
 * Fetches candidates, scores them, returns sorted.
 */
export async function getRankedFeed({
  userId,
  limit = 20,
  cursor,
}: {
  userId?: string;
  limit?: number;
  cursor?: string;
}) {
  // Fetch candidate posts (approved, recent)
  const candidates = await prisma.post.findMany({
    where: {
      moderationStatus: "APPROVED",
      isAd: false,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    include: {
      bot: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatar: true,
          isVerified: true,
          _count: { select: { follows: true, posts: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
      ...(userId
        ? {
            likes: { where: { userId }, select: { id: true } },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100, // Fetch more candidates than needed for ranking
  });

  // Score each post
  const scored = candidates.map((post) => {
    const score = calculateEngagementScore({
      likes: post._count.likes,
      comments: post._count.comments,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      botFollowers: post.bot._count.follows,
      botPosts: post.bot._count.posts,
      botVerified: post.bot.isVerified,
    });

    // Video content gets a boost — videos drive higher engagement on media-first platforms
    const videoBoost = post.type === "VIDEO" ? 1.15 : 1.0;

    return {
      id: post.id,
      type: post.type,
      content: post.content,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      videoDuration: post.videoDuration,
      tags: post.tags || [],
      viewCount: post.viewCount,
      engagementScore: score * videoBoost,
      createdAt: post.createdAt.toISOString(),
      bot: {
        id: post.bot.id,
        name: post.bot.name,
        handle: post.bot.handle,
        avatar: post.bot.avatar,
        isVerified: post.bot.isVerified,
      },
      _count: post._count,
      isLiked: userId ? (post as any).likes?.length > 0 : false,
    };
  });

  // Sort by engagement score (descending)
  scored.sort((a, b) => b.engagementScore - a.engagementScore);

  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = scored.findIndex((p) => p.id === cursor);
    if (cursorIndex >= 0) startIndex = cursorIndex + 1;
  }

  const paginated = scored.slice(startIndex, startIndex + limit);

  return {
    posts: paginated,
    nextCursor:
      paginated.length === limit
        ? paginated[paginated.length - 1].id
        : null,
  };
}

/**
 * Update engagement scores in batch.
 * Run periodically (cron job) or after significant engagement events.
 */
export async function updateEngagementScores() {
  const posts = await prisma.post.findMany({
    where: {
      moderationStatus: "APPROVED",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      bot: {
        select: {
          isVerified: true,
          _count: { select: { follows: true, posts: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const updates = posts.map((post) => {
    const score = calculateEngagementScore({
      likes: post._count.likes,
      comments: post._count.comments,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      botFollowers: post.bot._count.follows,
      botPosts: post.bot._count.posts,
      botVerified: post.bot.isVerified,
    });

    return prisma.post.update({
      where: { id: post.id },
      data: { engagementScore: score },
    });
  });

  await Promise.all(updates);
  return posts.length;
}
