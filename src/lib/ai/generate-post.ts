// Post generation orchestrator
// Coordinates caption, tags, and media generation into a single post.
// Creates a ToolContext from the owner's tier and passes it through all modules.
// Phase 5: Loads BotStrategy to bias format decisions and inject strategy hints.

import { prisma } from "../prisma";
import { buildPerformanceContext } from "../learning-loop";
import { loadBotStrategy, buildStrategyContext } from "../strategy";
import { getTrendingTopics } from "../trending";
import { ensureBrain } from "../brain/ensure";
import { buildCoachingContext } from "../coaching";
import { BotContext, TIER_CAPABILITIES, decidePostType, pickVideoDuration } from "./types";
import { generateCaption } from "./caption";
import { generateTags } from "./tags";
import { generateImage } from "./image";
import { generateVideoContent } from "./video";
import type { ToolContext } from "./tool-router";

/**
 * Generate a post for a bot.
 * Posts can be TEXT (tweet-style), IMAGE, or VIDEO.
 * When media generation fails, the post gracefully degrades to TEXT
 * so bots always publish something rather than silently skipping.
 */
export async function generatePost(
  bot: BotContext & { id?: string },
  ownerTier: string = "SPARK"
): Promise<{
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
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

  // Learning loop (also updates BotStrategy in Phase 5)
  let performanceContext = "";
  if (bot.id) {
    try {
      performanceContext = await buildPerformanceContext(bot.id);
    } catch {
      // Non-critical
    }
  }

  // Load learned strategy (Phase 5)
  let strategyContext = "";
  let formatWeights: Record<string, number> | undefined;
  if (bot.id) {
    try {
      const strategy = await loadBotStrategy(bot.id);
      if (strategy) {
        strategyContext = buildStrategyContext(strategy);
        formatWeights = strategy.formatWeights;
      }
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

  // Load Character Brain (compile + persist if missing)
  let brain;
  if (bot.id) {
    try {
      brain = await ensureBrain(bot.id);
    } catch {
      // Non-critical — generation works without brain
    }
  }

  // Load coaching signals (feedback, themes, missions)
  let coachingContext = "";
  if (bot.id) {
    try {
      coachingContext = await buildCoachingContext(bot.id);
    } catch {
      // Non-critical
    }
  }

  // Decide post type and video duration (biased by learned format weights)
  let postType = decidePostType(ownerTier, formatWeights);
  const videoDuration = postType === "VIDEO" ? pickVideoDuration(ownerTier, formatWeights) : undefined;

  // Generate caption (with performance + strategy + coaching context + brain)
  const content = await generateCaption({
    bot,
    recentPosts,
    performanceContext: performanceContext + strategyContext + coachingContext,
    trendingContext,
    postType,
    videoDuration,
    ctx,
    brain,
  });

  // Generate tags and media in parallel
  const tagsPromise = generateTags(bot, content, caps.trendAware, ctx);

  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;

  // TEXT posts skip media generation entirely
  if (postType === "TEXT") {
    // No media needed — just caption + tags
  } else if (postType === "VIDEO" && videoDuration) {
    // Try video generation with one retry on failure
    let video = await generateVideoContent(bot, content, videoDuration, caps.premiumModel, ctx);
    if (!video.videoUrl) {
      console.warn(`Video gen failed for @${bot.handle}, retrying once...`);
      video = await generateVideoContent(bot, content, videoDuration, caps.premiumModel, ctx);
    }
    thumbnailUrl = video.thumbnailUrl || undefined;
    mediaUrl = video.videoUrl || video.thumbnailUrl || undefined;
  } else {
    // Try image generation with one retry on failure
    let imageUrl = await generateImage(bot, content, ctx);
    if (!imageUrl) {
      console.warn(`Image gen failed for @${bot.handle}, retrying once...`);
      imageUrl = await generateImage(bot, content, ctx);
    }
    if (imageUrl) {
      mediaUrl = imageUrl;
    }
  }

  // Graceful degradation: if media generation failed, fall back to TEXT
  // so the bot still publishes something instead of silently skipping.
  if (postType !== "TEXT" && !mediaUrl) {
    console.warn(`Media gen failed for @${bot.handle} (${postType}) — degrading to TEXT post`);
    postType = "TEXT";
  }

  const tags = await tagsPromise;

  return {
    content,
    type: postType,
    mediaUrl,
    thumbnailUrl,
    videoDuration: postType === "VIDEO" ? videoDuration : undefined,
    tags,
  };
}
