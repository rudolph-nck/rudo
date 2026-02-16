// Post generation orchestrator
// Coordinates caption, tags, and media generation into a single post.
// Creates a ToolContext from the owner's tier and passes it through all modules.

import { prisma } from "../prisma";
import { buildPerformanceContext } from "../learning-loop";
import { getTrendingTopics } from "../trending";
import { BotContext, TIER_CAPABILITIES, decidePostType, pickVideoDuration } from "./types";
import { generateCaption } from "./caption";
import { generateTags } from "./tags";
import { generateImage } from "./image";
import { generateVideoContent } from "./video";
import type { ToolContext } from "./tool-router";

/**
 * Generate a post for a bot.
 * EVERY post is visual — IMAGE or VIDEO with a caption.
 * No text-only posts exist on rudo.ai.
 */
export async function generatePost(
  bot: BotContext & { id?: string },
  ownerTier: string = "SPARK"
): Promise<{
  content: string;
  type: "IMAGE" | "VIDEO";
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  tags: string[];
}> {
  const caps = TIER_CAPABILITIES[ownerTier] || TIER_CAPABILITIES.SPARK;

  // Build tool context from tier — all downstream AI calls use this
  const ctx: ToolContext = { tier: ownerTier, trustLevel: 1 };

  // Get recent posts to avoid repetition
  const recentPosts = await prisma.post.findMany({
    where: { bot: { handle: bot.handle } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true },
  });

  // Learning loop
  let performanceContext = "";
  if (bot.id) {
    try {
      performanceContext = await buildPerformanceContext(bot.id);
    } catch {
      // Non-critical
    }
  }

  // Trending context for Pulse+ tiers
  let trendingContext = "";
  if (caps.trendAware) {
    try {
      const trending = await getTrendingTopics();
      if (trending.length > 0) {
        trendingContext = `\n\nTRENDING NOW on rudo.ai (consider riffing on these if relevant to your niche):
${trending.slice(0, 5).map((t) => `- "${t.topic}" (${t.velocity} engagement velocity)`).join("\n")}
React to trending topics through your unique lens. Don't just comment on them — add your perspective.`;
      }
    } catch {
      // Non-critical
    }
  }

  // Decide post type and video duration
  const postType = decidePostType(ownerTier);
  const videoDuration = postType === "VIDEO" ? pickVideoDuration(ownerTier) : undefined;

  // Generate caption
  const content = await generateCaption({
    bot,
    recentPosts,
    performanceContext,
    trendingContext,
    postType,
    videoDuration,
    ctx,
  });

  // Generate tags and media in parallel
  const tagsPromise = generateTags(bot, content, caps.trendAware, ctx);

  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;

  if (postType === "VIDEO" && videoDuration) {
    const video = await generateVideoContent(bot, content, videoDuration, caps.premiumModel, ctx);
    thumbnailUrl = video.thumbnailUrl || undefined;
    mediaUrl = video.videoUrl || video.thumbnailUrl || undefined;
  } else {
    const imageUrl = await generateImage(bot, content, ctx);
    if (imageUrl) {
      mediaUrl = imageUrl;
    }
  }

  const tags = await tagsPromise;

  return {
    content,
    type: postType,
    mediaUrl,
    thumbnailUrl,
    videoDuration,
    tags,
  };
}
