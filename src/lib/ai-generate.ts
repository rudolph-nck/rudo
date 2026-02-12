import OpenAI from "openai";
import { prisma } from "./prisma";
import { moderateContent } from "./moderation";
import { buildPerformanceContext } from "./learning-loop";
import { getTrendingTopics } from "./trending";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

type BotContext = {
  name: string;
  handle: string;
  personality: string | null;
  contentStyle: string | null;
  niche: string | null;
  tone: string | null;
  aesthetic: string | null;
  bio: string | null;
};

// Tier capabilities for content generation
const TIER_CAPABILITIES: Record<string, {
  canGenerateImages: boolean;
  canGenerateVideo: boolean;
  maxVideoDuration: number;
  premiumModel: boolean;
  trendAware: boolean;
}> = {
  SPARK: { canGenerateImages: true, canGenerateVideo: false, maxVideoDuration: 15, premiumModel: false, trendAware: false },
  PULSE: { canGenerateImages: true, canGenerateVideo: true, maxVideoDuration: 30, premiumModel: false, trendAware: true },
  GRID: { canGenerateImages: true, canGenerateVideo: true, maxVideoDuration: 60, premiumModel: true, trendAware: true },
};

/**
 * Decide what type of post to generate based on tier and randomness.
 * Higher tiers get more variety.
 */
function decidePostType(tier: string): "TEXT" | "IMAGE" {
  const caps = TIER_CAPABILITIES[tier];
  if (!caps?.canGenerateImages) return "TEXT";

  // 40% chance of image post for tiers that support it
  return Math.random() < 0.4 ? "IMAGE" : "TEXT";
}

/**
 * Generate an image using DALL-E 3 based on bot personality and post content.
 */
async function generateImage(
  bot: BotContext,
  postContent: string
): Promise<string | null> {
  try {
    const imagePrompt = `Create a social media image for an AI creator named "${bot.name}".
Style: ${bot.aesthetic || "modern digital art"}.
Niche: ${bot.niche || "general"}.
Context: ${postContent.slice(0, 200)}

The image should be visually striking, suitable for a social media feed, and match the aesthetic described. No text overlays.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return response.data?.[0]?.url || null;
  } catch (error: any) {
    console.error("Image generation failed:", error.message);
    return null;
  }
}

/**
 * Generate a post for a bot based on its personality configuration.
 * Uses the learning loop to inject performance insights into the prompt.
 * Tier determines capabilities (images, trending awareness, etc.)
 */
export async function generatePost(
  bot: BotContext & { id?: string },
  ownerTier: string = "SPARK"
): Promise<{
  content: string;
  type: "TEXT" | "IMAGE";
  mediaUrl?: string;
}> {
  const caps = TIER_CAPABILITIES[ownerTier] || TIER_CAPABILITIES.SPARK;

  // Get recent posts to avoid repetition
  const recentPosts = await prisma.post.findMany({
    where: { bot: { handle: bot.handle } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true },
  });

  const recentContext =
    recentPosts.length > 0
      ? `\n\nRecent posts (DO NOT repeat these themes):\n${recentPosts.map((p) => `- ${p.content.slice(0, 100)}`).join("\n")}`
      : "";

  // Learning loop: pull performance insights if bot has enough history
  let performanceContext = "";
  if (bot.id) {
    try {
      performanceContext = await buildPerformanceContext(bot.id);
    } catch {
      // Non-critical — continue without performance data
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

  const postType = decidePostType(ownerTier);
  const imageInstruction = postType === "IMAGE"
    ? "\n- This post WILL include a generated image. Write a caption (50-200 chars) that works WITH a visual, not as standalone text. Be evocative and descriptive."
    : "";

  const model = caps.premiumModel ? "gpt-4o" : "gpt-4o-mini";

  const systemPrompt = `You are an AI content creator bot on a social media platform called rudo.ai.

Your identity:
- Name: ${bot.name}
- Handle: @${bot.handle}
${bot.bio ? `- Bio: ${bot.bio}` : ""}
${bot.personality ? `- Personality: ${bot.personality}` : ""}
${bot.niche ? `- Niche: ${bot.niche}` : ""}
${bot.tone ? `- Tone: ${bot.tone}` : ""}
${bot.aesthetic ? `- Aesthetic: ${bot.aesthetic}` : ""}
${bot.contentStyle ? `- Content style: ${bot.contentStyle}` : ""}

Rules:
- Write a single social media post (no hashtags, no emojis unless they fit your persona)
- Stay in character at all times
- Be original and creative
- Keep posts between 50-500 characters
- Don't use meta-commentary like "Here's my post" or "Today I'm posting about"
- Just write the post content directly
- No harmful, hateful, or inappropriate content${imageInstruction}${recentContext}${performanceContext}${trendingContext}`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate your next post." },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";

  // Generate image if this is an image post
  let mediaUrl: string | undefined;
  if (postType === "IMAGE") {
    const imageUrl = await generateImage(bot, content);
    if (imageUrl) {
      mediaUrl = imageUrl;
    }
  }

  return {
    content,
    type: mediaUrl ? "IMAGE" : "TEXT",
    mediaUrl,
  };
}

/**
 * Generate and publish a post for a bot.
 * Runs moderation before publishing.
 */
export async function generateAndPublish(botId: string): Promise<{
  success: boolean;
  postId?: string;
  reason?: string;
}> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { owner: { select: { tier: true } } },
  });

  if (!bot) return { success: false, reason: "Bot not found" };
  if (bot.isBYOB) return { success: false, reason: "BYOB bots generate their own content" };

  // Check if owner has an AI tier (Spark+)
  const aiTiers = ["SPARK", "PULSE", "GRID"];
  if (!aiTiers.includes(bot.owner.tier)) {
    return { success: false, reason: "Bot owner must be on Spark or higher for AI generation" };
  }

  // Check daily post limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = await prisma.post.count({
    where: { botId, createdAt: { gte: today } },
  });

  if (postsToday >= bot.postsPerDay) {
    return { success: false, reason: "Daily post limit reached" };
  }

  try {
    const generated = await generatePost(bot, bot.owner.tier);

    // Run through moderation
    const modResult = moderateContent(generated.content);
    const status = modResult.approved ? "APPROVED" : (modResult.score >= 0.6 ? "REJECTED" : "PENDING");

    const post = await prisma.post.create({
      data: {
        botId,
        type: generated.type,
        content: generated.content,
        mediaUrl: generated.mediaUrl,
        moderationStatus: status,
        moderationNote: modResult.reason,
        moderationScore: modResult.score,
        moderationFlags: modResult.flags,
        moderatedAt: new Date(),
      },
    });

    // Update bot's last posted time
    await prisma.bot.update({
      where: { id: botId },
      data: { lastPostedAt: new Date() },
    });

    return { success: true, postId: post.id };
  } catch (error: any) {
    console.error(`AI generation failed for bot ${botId}:`, error.message);
    return { success: false, reason: error.message };
  }
}
