// In-feed ad placement system
// Selects and injects ads into the feed for spectator monetization

import { prisma } from "./prisma";
import type { FeedPost } from "@/types";

// Insert ads every N posts in the feed
const AD_FREQUENCY = 5; // Show ad after every 5th post

export type FeedAd = {
  id: string;
  isAd: true;
  title: string;
  content: string;
  mediaUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  advertiser: string;
};

/**
 * Select an active ad to show. Uses simple rotation for now.
 * Can be enhanced with targeting, frequency capping, etc.
 */
export async function selectAd(): Promise<FeedAd | null> {
  try {
    const now = new Date();

    // Find active ads with remaining budget using raw filter
    const ads = await prisma.ad.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: {
        budget: "desc",
      },
    });

    // Filter to ads that haven't exhausted their budget
    const ad = ads.find((a) => a.spent < a.budget) || null;

    if (!ad) return null;

    // Record impression
    await prisma.ad.update({
      where: { id: ad.id },
      data: {
        impressions: { increment: 1 },
        spent: { increment: ad.cpm / 1000 }, // CPM = cost per mille
      },
    });

    return {
      id: ad.id,
      isAd: true,
      title: ad.title,
      content: ad.content,
      mediaUrl: ad.mediaUrl,
      ctaText: ad.ctaText,
      ctaUrl: ad.ctaUrl,
      advertiser: ad.advertiser,
    };
  } catch {
    return null;
  }
}

/**
 * Interleave ads into a feed of posts.
 * Free tier users see ads. Paid users don't (unless BYOB Free).
 */
export async function interleaveAds(
  posts: any[],
  userTier: string = "FREE"
): Promise<any[]> {
  // Paid users don't see ads (except free BYOB tier)
  const adFreeTiers = ["BYOB_PRO", "SPARK", "PULSE", "GRID", "ENTERPRISE"];
  if (adFreeTiers.includes(userTier)) {
    return posts;
  }

  const result: any[] = [];

  for (let i = 0; i < posts.length; i++) {
    result.push(posts[i]);

    // Insert ad after every AD_FREQUENCY posts
    if ((i + 1) % AD_FREQUENCY === 0) {
      const ad = await selectAd();
      if (ad) {
        result.push(ad);
      }
    }
  }

  return result;
}

/**
 * Record an ad click
 */
export async function recordAdClick(adId: string) {
  try {
    await prisma.ad.update({
      where: { id: adId },
      data: { clicks: { increment: 1 } },
    });
  } catch {
    // silent
  }
}
