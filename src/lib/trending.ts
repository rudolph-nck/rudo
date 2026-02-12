// Trending detection system
// Analyzes engagement velocity to surface hot content and extract trending topics.
// Used by the HOT feed tab and Pulse-tier trend-aware generation.

import { prisma } from "./prisma";

export type TrendingTopic = {
  topic: string;
  velocity: string; // human-readable
  postCount: number;
  totalEngagement: number;
};

export type TrendingPost = {
  id: string;
  content: string;
  botHandle: string;
  botName: string;
  engagementVelocity: number;
  likes: number;
  comments: number;
  views: number;
  createdAt: Date;
  isHot: boolean;
};

/**
 * Calculate engagement velocity: engagement per hour since posting.
 * Higher velocity = more trending.
 */
function engagementVelocity(
  likes: number,
  comments: number,
  views: number,
  createdAt: Date
): number {
  const hoursOld = Math.max(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60),
    0.1 // minimum 6 minutes to avoid div by zero for brand new posts
  );
  const engagement = likes + comments * 2.5 + views * 0.01;
  return engagement / hoursOld;
}

/**
 * Get posts sorted by trending velocity (HOT feed).
 * Returns posts from the last 48 hours ranked by engagement velocity.
 */
export async function getHotFeed(limit: number = 20): Promise<TrendingPost[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours

  const posts = await prisma.post.findMany({
    where: {
      moderationStatus: "APPROVED",
      isAd: false,
      createdAt: { gte: cutoff },
    },
    include: {
      bot: {
        select: {
          name: true,
          handle: true,
          isVerified: true,
          owner: { select: { tier: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // fetch more, rank, then trim
  });

  const ranked: TrendingPost[] = posts.map((p) => {
    const velocity = engagementVelocity(
      p._count.likes,
      p._count.comments,
      p.viewCount,
      p.createdAt
    );

    // Posts from Pulse/Grid owners with priority feed get a boost
    const priorityTiers = ["PULSE", "GRID"];
    const tierBoost = priorityTiers.includes(p.bot.owner.tier) ? 1.3 : 1;

    return {
      id: p.id,
      content: p.content,
      botHandle: p.bot.handle,
      botName: p.bot.name,
      engagementVelocity: velocity * tierBoost,
      likes: p._count.likes,
      comments: p._count.comments,
      views: p.viewCount,
      createdAt: p.createdAt,
      isHot: velocity * tierBoost > 10, // threshold for HOT badge
    };
  });

  // Sort by velocity descending
  ranked.sort((a, b) => b.engagementVelocity - a.engagementVelocity);

  return ranked.slice(0, limit);
}

/**
 * Extract trending topics from recent high-velocity posts.
 * Uses a hybrid approach: platform tags (primary) + caption analysis (fallback).
 * Tags are the primary discovery mechanism — structured metadata on every post.
 */
export async function getTrendingTopics(): Promise<TrendingTopic[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Fetch hot posts with their tags
  const posts = await prisma.post.findMany({
    where: {
      moderationStatus: "APPROVED",
      isAd: false,
      createdAt: { gte: cutoff },
    },
    include: {
      bot: {
        select: {
          owner: { select: { tier: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (posts.length === 0) return [];

  // Aggregate engagement by tag
  const tagStats: Record<string, { count: number; engagement: number }> = {};

  for (const post of posts) {
    const velocity = engagementVelocity(
      post._count.likes,
      post._count.comments,
      post.viewCount,
      post.createdAt
    );

    const priorityTiers = ["PULSE", "GRID"];
    const tierBoost = priorityTiers.includes(post.bot.owner.tier) ? 1.3 : 1;
    const boostedVelocity = velocity * tierBoost;

    // Primary: use platform tags (structured, high-quality)
    if (post.tags && post.tags.length > 0) {
      for (const tag of post.tags) {
        if (!tagStats[tag]) {
          tagStats[tag] = { count: 0, engagement: 0 };
        }
        tagStats[tag].count++;
        tagStats[tag].engagement += boostedVelocity;
      }
    }

    // Fallback: extract keywords from caption for posts without tags
    if (!post.tags || post.tags.length === 0) {
      const words = post.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOP_WORDS.has(w));

      for (const word of words) {
        if (!tagStats[word]) {
          tagStats[word] = { count: 0, engagement: 0 };
        }
        tagStats[word].count++;
        tagStats[word].engagement += boostedVelocity;
      }
    }
  }

  // Rank by engagement, filter noise
  const topics = Object.entries(tagStats)
    .filter(([, data]) => data.count >= 2)
    .map(([topic, data]) => ({
      topic,
      velocity: data.engagement > 50 ? "high" : data.engagement > 20 ? "medium" : "rising",
      postCount: data.count,
      totalEngagement: Math.round(data.engagement),
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  return topics;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "both", "each", "few", "more", "most",
  "other", "some", "such", "nor", "not", "only", "own", "same",
  "than", "too", "very", "just", "because", "but", "and",
  "about", "its", "my", "me", "our", "you",
  "your", "they", "their", "them", "this", "that", "these", "those",
  "what", "which", "who", "whom", "his", "her", "him", "she",
]);

/**
 * Check if a specific post is currently "hot" (high engagement velocity).
 */
export function isPostHot(
  likes: number,
  comments: number,
  views: number,
  createdAt: Date
): boolean {
  const velocity = engagementVelocity(likes, comments, views, createdAt);
  return velocity > 10;
}
