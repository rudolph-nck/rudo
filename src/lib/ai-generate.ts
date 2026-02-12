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
  characterRef: string | null;
  characterRefDescription: string | null;
};

// Tier capabilities for content generation
const TIER_CAPABILITIES: Record<string, {
  canGenerateImages: boolean;
  canGenerateVideo: boolean;
  maxVideoDuration: number;
  premiumModel: boolean;
  trendAware: boolean;
  canUploadCharacterRef: boolean;
}> = {
  SPARK:  { canGenerateImages: true,  canGenerateVideo: false, maxVideoDuration: 15, premiumModel: false, trendAware: false, canUploadCharacterRef: false },
  PULSE:  { canGenerateImages: true,  canGenerateVideo: true,  maxVideoDuration: 30, premiumModel: false, trendAware: true,  canUploadCharacterRef: false },
  GRID:   { canGenerateImages: true,  canGenerateVideo: true,  maxVideoDuration: 60, premiumModel: true,  trendAware: true,  canUploadCharacterRef: true },
};

/**
 * Media-first platform: every post is visual.
 * Decide between IMAGE and VIDEO based on tier.
 * VIDEO is the aspirational format (TikTok/Reels style) — gated to Pulse+.
 */
function decidePostType(tier: string): "IMAGE" | "VIDEO" {
  const caps = TIER_CAPABILITIES[tier];
  if (!caps?.canGenerateVideo) return "IMAGE";

  // Pulse+: 70% image, 30% video (video gen is expensive / aspirational)
  return Math.random() < 0.3 ? "VIDEO" : "IMAGE";
}

/**
 * Build a character reference prompt fragment.
 * If the bot has an analyzed character ref, inject its description
 * for visual consistency across all generated media.
 */
function buildCharacterContext(bot: BotContext): string {
  if (!bot.characterRefDescription) return "";

  return `\n\nCHARACTER REFERENCE (use this to maintain visual consistency):
${bot.characterRefDescription}
Always depict this character/entity consistently. Maintain the same visual identity, colors, features, and style across all generated images.`;
}

/**
 * Generate an image using DALL-E 3 based on bot personality, post content,
 * and optional character reference for consistency.
 */
async function generateImage(
  bot: BotContext,
  postContent: string
): Promise<string | null> {
  try {
    const characterContext = bot.characterRefDescription
      ? `\nCharacter/Entity to feature: ${bot.characterRefDescription}`
      : "";

    const imagePrompt = `Create a visually striking social media image for an AI creator.
Creator identity: "${bot.name}" — ${bot.bio || "AI content creator"}.
Style: ${bot.aesthetic || "modern digital art"}.
Niche: ${bot.niche || "general"}.
Caption context: ${postContent.slice(0, 200)}${characterContext}

Requirements:
- Eye-catching, feed-stopping visual suitable for Instagram/TikTok
- Match the aesthetic and mood of the creator's brand
- Bold composition, vibrant or atmospheric depending on niche
- No text overlays, no watermarks
- Square format, high impact`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    return response.data?.[0]?.url || null;
  } catch (error: any) {
    console.error("Image generation failed:", error.message);
    return null;
  }
}

/**
 * Generate a video concept description.
 * Actual video generation would integrate with Runway/Pika/Sora APIs.
 * For now, generates a compelling thumbnail image + video metadata.
 */
async function generateVideoContent(
  bot: BotContext,
  caption: string
): Promise<{ thumbnailUrl: string | null; videoConcept: string }> {
  // Generate a thumbnail frame for the video
  const thumbnailUrl = await generateImage(bot, caption);

  // Generate video concept/storyboard (for future video API integration)
  const videoConcept = `[Video concept for @${bot.handle}]: ${caption}`;

  return { thumbnailUrl, videoConcept };
}

/**
 * Generate avatar image for a bot using DALL-E 3.
 * Uses bot personality, aesthetic, and character reference to create
 * a consistent profile picture.
 */
export async function generateAvatar(
  bot: BotContext
): Promise<string | null> {
  try {
    const characterHint = bot.characterRefDescription
      ? `Based on this character: ${bot.characterRefDescription}`
      : `An abstract, iconic representation of an AI entity named "${bot.name}"`;

    const prompt = `Create a profile picture / avatar for an AI content creator.
${characterHint}
Aesthetic: ${bot.aesthetic || "modern digital"}.
Niche: ${bot.niche || "general"}.
Personality: ${bot.personality?.slice(0, 150) || "creative AI"}

Requirements:
- Circular-crop friendly (centered subject)
- Bold, iconic, immediately recognizable at small sizes
- ${bot.aesthetic || "modern"} style
- No text, no watermarks
- Single subject/entity, clean background or atmospheric backdrop
- Should feel like a distinctive social media profile picture`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return response.data?.[0]?.url || null;
  } catch (error: any) {
    console.error("Avatar generation failed:", error.message);
    return null;
  }
}

/**
 * Generate banner image for a bot using DALL-E 3.
 */
export async function generateBanner(
  bot: BotContext
): Promise<string | null> {
  try {
    const characterHint = bot.characterRefDescription
      ? `Feature this character/entity: ${bot.characterRefDescription}`
      : "";

    const prompt = `Create a wide banner image for an AI content creator's profile.
Creator: "${bot.name}" — ${bot.bio || "AI creator"}.
Aesthetic: ${bot.aesthetic || "modern digital"}.
Niche: ${bot.niche || "general"}.
${characterHint}

Requirements:
- Wide landscape format (banner/header style)
- Atmospheric, sets the mood for the creator's brand
- ${bot.aesthetic || "modern"} style, visually immersive
- No text, no watermarks
- Should work as a profile header/banner background`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    return response.data?.[0]?.url || null;
  } catch (error: any) {
    console.error("Banner generation failed:", error.message);
    return null;
  }
}

/**
 * Analyze an uploaded character reference image using GPT-4o Vision.
 * Returns a detailed text description that can be injected into
 * future DALL-E prompts for visual consistency.
 */
export async function analyzeCharacterReference(
  imageUrl: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert visual analyst. Analyze this character/entity reference image and produce a detailed, reusable description that can be used in future image generation prompts to maintain visual consistency.

Focus on:
- Physical appearance (body type, features, colors, distinguishing marks)
- Clothing/outfit style and colors
- Color palette and aesthetic
- Art style (anime, realistic, pixel, 3D, etc.)
- Key visual motifs or accessories
- Overall mood/vibe

Write the description as a single paragraph, 100-200 words, in a format that works as a DALL-E prompt fragment. Start directly with the description, no preamble.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this character reference image and provide a detailed, reusable visual description.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    max_tokens: 400,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

/**
 * Generate a post for a bot — MEDIA-FIRST.
 * Every post includes visual media (image or video).
 * Text is a caption, not standalone content.
 */
export async function generatePost(
  bot: BotContext & { id?: string },
  ownerTier: string = "SPARK"
): Promise<{
  content: string;
  type: "IMAGE" | "VIDEO";
  mediaUrl?: string;
  thumbnailUrl?: string;
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

  // Character reference context for visual consistency
  const characterContext = buildCharacterContext(bot);

  const postType = decidePostType(ownerTier);

  const captionInstruction = postType === "VIDEO"
    ? "\n- This post is a SHORT VIDEO (TikTok/Reels style). Write a compelling caption (50-200 chars) that hooks viewers and complements the visual. Think viral, shareable, stop-scrolling energy."
    : "\n- This post is an IMAGE post (Instagram style). Write a caption (50-300 chars) that works WITH a visual, not as standalone text. Be evocative, descriptive, and feed-stopping.";

  const model = caps.premiumModel ? "gpt-4o" : "gpt-4o-mini";

  const systemPrompt = `You are an AI content creator bot on rudo.ai — a media-first social platform where AI creators post images and videos (like TikTok meets Instagram, but every creator is AI).

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
- Write a caption for a visual post — this is a MEDIA-FIRST platform, every post has an image or video
- Stay in character at all times
- Be original and creative — think viral social media energy
- No hashtags unless they fit your persona naturally
- Don't use meta-commentary like "Here's my post" or "Check out my latest"
- Just write the caption directly${captionInstruction}${recentContext}${performanceContext}${trendingContext}${characterContext}`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate your next post caption." },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";

  // Generate media based on post type
  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;

  if (postType === "VIDEO") {
    const video = await generateVideoContent(bot, content);
    thumbnailUrl = video.thumbnailUrl || undefined;
    // Video URL would come from a video generation API (Runway/Pika/Sora)
    // For now, the thumbnail serves as the preview
    mediaUrl = video.thumbnailUrl || undefined;
  } else {
    const imageUrl = await generateImage(bot, content);
    if (imageUrl) {
      mediaUrl = imageUrl;
    }
  }

  return {
    content,
    type: postType,
    mediaUrl,
    thumbnailUrl,
  };
}

/**
 * Generate and publish a post for a bot.
 * Runs moderation before publishing.
 * All posts are media-first (image or video).
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
        thumbnailUrl: generated.thumbnailUrl,
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
