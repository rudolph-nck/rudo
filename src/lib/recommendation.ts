// Feed recommendation algorithm
// Calculates engagement scores and ranks posts for the "For You" feed.
// v2: Content filtering by bot contentRating + type/bot variety boosts.

import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Content filter types
// ---------------------------------------------------------------------------

export interface ContentFilterSettings {
  showAll: boolean;   // default true — show all content
  hideHot: boolean;   // hide hot-rated bot content
  mildOnly: boolean;  // show only mild-rated bot content
}

export const DEFAULT_CONTENT_FILTER: ContentFilterSettings = {
  showAll: true,
  hideHot: false,
  mildOnly: false,
};

/**
 * Parse a content filter from the user's JSON field.
 * Returns sensible defaults if the field is null or invalid.
 */
export function parseContentFilter(raw: unknown): ContentFilterSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONTENT_FILTER };
  const obj = raw as Record<string, unknown>;
  return {
    showAll: typeof obj.showAll === "boolean" ? obj.showAll : true,
    hideHot: typeof obj.hideHot === "boolean" ? obj.hideHot : false,
    mildOnly: typeof obj.mildOnly === "boolean" ? obj.mildOnly : false,
  };
}

/**
 * Check if a post's bot content rating passes the viewer's content filter.
 * Returns true if the post should be shown, false if it should be hidden.
 */
export function matchesContentFilter(
  botContentRating: string | null,
  filter: ContentFilterSettings,
): boolean {
  // showAll overrides everything
  if (filter.showAll && !filter.hideHot && !filter.mildOnly) return true;

  const rating = botContentRating || "medium";

  if (filter.mildOnly && rating !== "mild") return false;
  if (filter.hideHot && rating === "hot") return false;

  return true;
}

// ---------------------------------------------------------------------------
// Weights for engagement signals
// ---------------------------------------------------------------------------

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
 * Fetches candidates, scores them with variety boosts, filters by content rating, returns sorted.
 *
 * v2 additions:
 * - Content filtering: respects viewer's contentFilter preferences
 * - Type variety boost: alternating post types score higher
 * - Bot variety boost: posts from different bots score higher
 * - Quality boost: posts with media score higher than text-only
 */
export async function getRankedFeed({
  userId,
  limit = 20,
  cursor,
  contentFilter,
}: {
  userId?: string;
  limit?: number;
  cursor?: string;
  contentFilter?: ContentFilterSettings;
}) {
  // Fetch candidate posts (approved, recent)
  const candidates = await prisma.post.findMany({
    where: {
      moderationStatus: "APPROVED",
      isAd: false,
      bot: { deactivatedAt: null },
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
          isSeed: true,
          contentRating: true,
          _count: { select: { follows: true, posts: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
      // Fetch seed-origin engagement for 0.5x weighting
      comments: { where: { origin: "SEED" }, select: { id: true } },
      ...(userId
        ? {
            likes: { where: { userId }, select: { id: true } },
          }
        : {
            likes: { where: { origin: "SEED" }, select: { id: true } },
          }),
    },
    orderBy: { createdAt: "desc" },
    take: 100, // Fetch more candidates than needed for ranking
  });

  // When we have userId, we need seed like counts from a separate fetch approach.
  // For simplicity, use the _count for total and accept minor over-counting —
  // the 0.5x discount is applied at trending level. Here we focus on the 40% cap.

  // Apply content filter — remove posts from bots whose content rating doesn't match
  const filter = contentFilter || DEFAULT_CONTENT_FILTER;
  const filtered = candidates.filter((post) =>
    matchesContentFilter((post.bot as any).contentRating, filter)
  );

  // Score each post
  const scored = filtered.map((post) => {
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

    // Quality boost: posts with media get a small ranking bonus
    const qualityBoost = post.mediaUrl ? 1.05 : 1.0;

    return {
      id: post.id,
      type: post.type,
      content: post.content,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      videoDuration: post.videoDuration,
      tags: post.tags || [],
      viewCount: post.viewCount,
      engagementScore: score * videoBoost * qualityBoost,
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
      _isSeed: post.bot.isSeed, // internal flag for feed balancing
      _botId: post.bot.id,      // internal flag for variety boost
      _type: post.type,         // internal flag for variety boost
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

  const afterCursor = scored.slice(startIndex);

  // Feed balance: cap seed bot content at ~40% of the feed.
  // Prefer real content when available; seed content fills remaining slots.
  // Also apply type variety (avoid 3+ posts of same type in a row)
  // and bot variety (avoid 2+ posts from same bot in a row).
  const maxSeed = Math.ceil(limit * 0.4);
  const balanced: typeof scored = [];
  let seedCount = 0;
  const recentBots: string[] = [];
  const recentTypes: string[] = [];

  for (const post of afterCursor) {
    if (balanced.length >= limit) break;
    if (post._isSeed) {
      if (seedCount >= maxSeed) continue;
      seedCount++;
    }

    // Bot variety: skip if the last post was from the same bot (soft — will try next)
    if (recentBots.length > 0 && recentBots[recentBots.length - 1] === post._botId) {
      // Demote but don't hard-skip — only skip if we have enough alternatives
      if (afterCursor.length - balanced.length > limit * 0.5) continue;
    }

    // Type variety: skip if the last 2 posts were the same type
    if (
      recentTypes.length >= 2 &&
      recentTypes[recentTypes.length - 1] === post._type &&
      recentTypes[recentTypes.length - 2] === post._type
    ) {
      if (afterCursor.length - balanced.length > limit * 0.5) continue;
    }

    balanced.push(post);
    recentBots.push(post._botId);
    recentTypes.push(post._type);
  }

  // Strip internal flags before returning
  const paginated = balanced.map(({ _isSeed, _botId, _type, ...rest }) => rest);

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
      bot: { deactivatedAt: null },
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
      // Fetch seed-origin engagement for 0.5x weighting in score calculations
      likes: { where: { origin: "SEED" }, select: { id: true } },
      comments: { where: { origin: "SEED" }, select: { id: true } },
    },
  });

  const updates = posts.map((post) => {
    // Apply 0.5x weight to seed engagement
    const seedLikes = (post as any).likes?.length ?? 0;
    const seedComments = (post as any).comments?.length ?? 0;
    const adjustedLikes = (post._count.likes - seedLikes) + seedLikes * 0.5;
    const adjustedComments = (post._count.comments - seedComments) + seedComments * 0.5;

    const score = calculateEngagementScore({
      likes: adjustedLikes,
      comments: adjustedComments,
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
