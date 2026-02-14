import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import RunwayML from "@runwayml/sdk";
import { prisma } from "./prisma";
import { moderateContent } from "./moderation";
import { buildPerformanceContext } from "./learning-loop";
import { getTrendingTopics } from "./trending";
import { persistImage, isStorageConfigured } from "./media";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

fal.config({ credentials: process.env.FAL_KEY || "" });

const runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY || "" });

type BotContext = {
  name: string;
  handle: string;
  personality: string | null;
  contentStyle: string | null;
  niche: string | null;
  tone: string | null;
  aesthetic: string | null;
  artStyle: string | null;
  bio: string | null;
  characterRef: string | null;
  characterRefDescription: string | null;
  botType: string | null;
  personaData: string | null;
};

// ---------------------------------------------------------------------------
// Tier capabilities & content mix
// ---------------------------------------------------------------------------
// NO text-only posts. Every post is IMAGE or VIDEO.
// Video is the engagement driver (TikTok model).
// Higher tiers get more video AND a mix of durations.
//
// Duration calibration (current AI video gen ceilings):
//   6s  = single generation, punchy hook (Pika/Kling native)
//   15s = 1-2 stitches, short-form sweet spot (Reels/TikTok standard)
//   30s = 2-3 stitches, premium mini-stories, quality ceiling before degradation
//
// SPARK is a loss leader — video hooks users on seeing their bot create.
// The upgrade path to PULSE/GRID is where the revenue is.
//
// Cost control: Runway 30s is expensive (~$1.50/video). GRID gets 30s as
// a showcase feature (~8% of videos ≈ 1-2 per bot per week) rather than a
// regular cadence. This keeps GRID profitable while still feeling premium.
// ---------------------------------------------------------------------------

const TIER_CAPABILITIES: Record<string, {
  videoChance: number;
  videoDurationMix: { duration: number; weight: number }[];
  premiumModel: boolean;
  trendAware: boolean;
  canUploadCharacterRef: boolean;
}> = {
  SPARK: {
    videoChance: 0.35,
    videoDurationMix: [{ duration: 6, weight: 1.0 }],
    premiumModel: false,
    trendAware: false,
    canUploadCharacterRef: false,
  },
  PULSE: {
    videoChance: 0.45,
    videoDurationMix: [
      { duration: 6, weight: 0.65 },   // 65% quick hooks (cost-efficient)
      { duration: 15, weight: 0.35 },   // 35% short-form (signature format)
    ],
    premiumModel: false,
    trendAware: true,
    canUploadCharacterRef: false,
  },
  GRID: {
    videoChance: 0.55,
    videoDurationMix: [
      { duration: 6, weight: 0.45 },    // 45% quick hooks (cost-efficient)
      { duration: 15, weight: 0.47 },   // 47% short-form
      { duration: 30, weight: 0.08 },   // 8% premium stories (~1-2/week/bot)
    ],
    premiumModel: true,
    trendAware: true,
    canUploadCharacterRef: true,
  },
};

// ---------------------------------------------------------------------------
// Video creative direction by duration
// ---------------------------------------------------------------------------

const VIDEO_STYLE_BY_DURATION: Record<number, { label: string; direction: string }> = {
  6:  { label: "6-second hook", direction: "A single punchy moment — one striking visual transition, one dramatic reveal, or one mesmerizing loop. Think \"stop-scroll\" energy. No narrative arc needed, just pure visual impact." },
  15: { label: "15-second short", direction: "A mini-sequence with a beginning and payoff — establish a mood, build tension, deliver a moment. Think Instagram Reels / TikTok standard. Quick cuts or one fluid camera move." },
  30: { label: "30-second story", direction: "A micro-narrative with setup, development, and resolution. Think cinematic short — atmospheric establishing shot, character/subject action, and a memorable closing frame. Allow the visual to breathe." },
};

// ---------------------------------------------------------------------------
// Content type decisions
// ---------------------------------------------------------------------------

/**
 * Decide IMAGE or VIDEO. No text-only posts — ever.
 */
function decidePostType(tier: string): "IMAGE" | "VIDEO" {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;
  return Math.random() < caps.videoChance ? "VIDEO" : "IMAGE";
}

/**
 * Pick a video duration from the tier's weighted mix.
 * e.g. GRID might roll 6s (30%), 15s (40%), or 30s (30%).
 */
function pickVideoDuration(tier: string): number {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;
  const roll = Math.random();
  let cumulative = 0;
  for (const { duration, weight } of caps.videoDurationMix) {
    cumulative += weight;
    if (roll < cumulative) return duration;
  }
  return caps.videoDurationMix[0].duration;
}

// ---------------------------------------------------------------------------
// Tag generation
// ---------------------------------------------------------------------------

/**
 * Generate 2-5 platform tags for a post using AI.
 * Tags are structured metadata for discovery — NOT inline hashtags.
 * They power trending, topic browsing, feed recommendations, and explore.
 *
 * Trend-aware tiers (Pulse+) get tags optimized against current trending topics.
 */
async function generateTags(
  bot: BotContext,
  caption: string,
  trendAware: boolean,
  model: string
): Promise<string[]> {
  try {
    let trendingHint = "";
    if (trendAware) {
      try {
        const trending = await getTrendingTopics();
        if (trending.length > 0) {
          trendingHint = `\nCurrently trending on rudo.ai: ${trending.slice(0, 5).map(t => t.topic).join(", ")}
If any trending topics are relevant, include them as tags to boost discoverability.`;
        }
      } catch {
        // Non-critical
      }
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a social media tag generator for rudo.ai, an AI creator platform. Generate 2-5 discovery tags for a post.

Rules:
- Tags are lowercase, 1-3 words each, no # symbol
- Mix specific and broad: e.g. ["digital art", "cyberpunk", "neon cityscape", "ai art"]
- Include the creator's niche as a tag
- Tags should help users discover this content through topic browsing
- No generic filler tags like "content" or "post"
- Return ONLY valid JSON: { "tags": ["tag1", "tag2", ...] }${trendingHint}`,
        },
        {
          role: "user",
          content: `Creator: @${bot.handle} (${bot.niche || "general"}, ${bot.aesthetic || "modern"} aesthetic)\nCaption: ${caption}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(content);
    const tags = Array.isArray(parsed) ? parsed : (parsed.tags || []);
    return tags
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.toLowerCase().replace(/^#/, "").trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 5);
  } catch (error: any) {
    console.error("Tag generation failed:", error.message);
    // Fallback: extract tags from bot niche
    const fallback = [bot.niche?.toLowerCase(), bot.aesthetic?.toLowerCase()].filter(Boolean) as string[];
    return fallback.length > 0 ? fallback : ["ai creator"];
  }
}

// ---------------------------------------------------------------------------
// Character reference helpers
// ---------------------------------------------------------------------------

function buildCharacterContext(bot: BotContext): string {
  if (!bot.characterRefDescription) return "";

  return `\n\nCHARACTER REFERENCE (use this to maintain visual consistency):
${bot.characterRefDescription}
Always depict this character/entity consistently. Maintain the same visual identity, colors, features, and style across all generated images.`;
}

// ---------------------------------------------------------------------------
// Art style rendering instructions
// ---------------------------------------------------------------------------

const ART_STYLE_PROMPTS: Record<string, string> = {
  realistic: "Photorealistic, lifelike, high-resolution photography style",
  cartoon: "Bold cartoon style with clean outlines, exaggerated features, vibrant flat colors",
  anime: "Japanese anime/manga illustration style with large expressive eyes and dynamic poses",
  "3d_render": "Clean 3D rendered style, smooth surfaces, studio lighting, Pixar/Blender quality",
  watercolor: "Delicate watercolor painting style with soft washes, visible brush strokes, paper texture",
  pixel_art: "Retro pixel art style, chunky pixels, limited color palette, 16-bit era aesthetic",
  oil_painting: "Classical oil painting style, rich impasto textures, museum-quality fine art look",
  comic_book: "Dynamic comic book illustration, bold ink lines, halftone dots, action panels",
};

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

async function generateImage(
  bot: BotContext,
  postContent: string
): Promise<string | null> {
  try {
    const characterContext = bot.characterRefDescription
      ? `\nCharacter/Entity to feature: ${bot.characterRefDescription}`
      : "";

    const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

    const imagePrompt = `Create a visually striking social media image for an AI creator.
Creator identity: "${bot.name}" — ${bot.bio || "AI content creator"}.
Style: ${bot.aesthetic || "modern digital art"}.
Art style: ${artStyleHint}.
Niche: ${bot.niche || "general"}.
Caption context: ${postContent.slice(0, 200)}${characterContext}

Requirements:
- Render in ${artStyleHint} style
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

    const tempUrl = response.data?.[0]?.url || null;
    if (!tempUrl) return null;

    // Persist to S3 before DALL-E URL expires (~1 hour)
    if (!isStorageConfigured()) {
      console.warn("S3 not configured — DALL-E image will NOT be stored (temp URLs expire). Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and NEXT_PUBLIC_MEDIA_URL.");
      return null;
    }

    try {
      return await persistImage(tempUrl, "posts/images");
    } catch (err: any) {
      console.error("Failed to persist image to S3:", err.message);
      return null;
    }
  } catch (error: any) {
    console.error("Image generation failed:", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video generation — fal.ai (Kling/Minimax) + Runway (Gen-3 Alpha premium)
// ---------------------------------------------------------------------------
//
// Routing strategy:
//   SPARK/PULSE  → fal.ai (Kling for 6s, Minimax for 15s) — fast & cost-efficient
//   GRID 30s     → Runway Gen-3 Alpha Turbo — highest quality, premium tier only
//   Fallback     → If Runway fails, gracefully degrade to fal.ai Minimax
// ---------------------------------------------------------------------------

const FAL_MODELS: Record<number, { model: string; label: string }> = {
  6:  { model: "fal-ai/kling-video/v2/master/text-to-video", label: "Kling v2" },
  15: { model: "fal-ai/minimax-video/video-01/text-to-video", label: "Minimax" },
  30: { model: "fal-ai/minimax-video/video-01/text-to-video", label: "Minimax" },
};

async function generateVideoFal(
  prompt: string,
  durationSec: number
): Promise<string | null> {
  const modelConfig = FAL_MODELS[durationSec] || FAL_MODELS[6];

  try {
    const result = await fal.subscribe(modelConfig.model, {
      input: {
        prompt,
        duration: durationSec <= 6 ? "5" : "10",
        aspect_ratio: "9:16",
      },
      logs: false,
    }) as { data: { video?: { url?: string }; video_url?: string } };

    const videoUrl = result.data?.video?.url || result.data?.video_url || null;
    return videoUrl;
  } catch (error: any) {
    console.error(`fal.ai video failed (${modelConfig.label}):`, error.message);
    return null;
  }
}

async function generateVideoRunway(
  prompt: string,
  durationSec: number,
  startFrameUrl: string
): Promise<string | null> {
  if (!process.env.RUNWAY_API_KEY || !startFrameUrl) return null;

  try {
    const task = await runway.imageToVideo.create({
      model: "gen3a_turbo",
      promptImage: startFrameUrl,
      promptText: prompt,
      duration: durationSec >= 10 ? 10 : 5,
      ratio: "768:1280",
    });

    // Poll until complete (Runway is async)
    let result = await runway.tasks.retrieve(task.id);
    const maxWait = 5 * 60 * 1000; // 5 min max
    const start = Date.now();

    while (result.status !== "SUCCEEDED" && result.status !== "FAILED") {
      if (Date.now() - start > maxWait) {
        console.error("Runway timed out after 5 minutes");
        return null;
      }
      await new Promise((r) => setTimeout(r, 5000));
      result = await runway.tasks.retrieve(task.id);
    }

    if (result.status === "FAILED") {
      console.error("Runway generation failed:", result.failure);
      return null;
    }

    const output = result.output as string[] | undefined;
    return output?.[0] || null;
  } catch (error: any) {
    console.error("Runway video failed:", error.message);
    return null;
  }
}

async function generateVideoContent(
  bot: BotContext,
  caption: string,
  durationSec: number,
  usePremium: boolean = false
): Promise<{ videoUrl: string | null; thumbnailUrl: string | null; duration: number }> {
  const style = VIDEO_STYLE_BY_DURATION[durationSec] || VIDEO_STYLE_BY_DURATION[6];

  const characterContext = bot.characterRefDescription
    ? `\nCharacter/Entity: ${bot.characterRefDescription}`
    : "";

  const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

  const videoPrompt = `${style.direction}

Creator: "${bot.name}" — ${bot.bio || "AI content creator"}.
Visual style: ${bot.aesthetic || "modern digital art"}, ${bot.niche || "general"} niche.
Art style: ${artStyleHint}.${characterContext}

Context: ${caption}

Requirements:
- Render in ${artStyleHint} style
- Vertical format (9:16), social media optimized
- No text overlays, no watermarks
- Cinematic quality, feed-stopping visual`;

  // Runway (image-to-video) needs a DALL-E start frame.
  // fal.ai is text-to-video — no thumbnail needed, skip the extra DALL-E call.
  const needsRunway = usePremium && durationSec >= 30 && !!process.env.RUNWAY_API_KEY;

  let videoUrl: string | null = null;
  let thumbnailUrl: string | null = null;

  if (needsRunway) {
    thumbnailUrl = await generateImage(bot, caption);
    if (thumbnailUrl) {
      videoUrl = await generateVideoRunway(videoPrompt, durationSec, thumbnailUrl);
    }
    if (!videoUrl) {
      console.log("Runway unavailable, falling back to fal.ai");
      videoUrl = await generateVideoFal(videoPrompt, durationSec);
    }
  } else {
    videoUrl = await generateVideoFal(videoPrompt, durationSec);
  }

  return { videoUrl, thumbnailUrl, duration: durationSec };
}

// ---------------------------------------------------------------------------
// Avatar generation (Flux via fal.ai)
// ---------------------------------------------------------------------------

export async function generateAvatar(
  bot: BotContext
): Promise<string | null> {
  try {
    // Parse persona data for person-type bots
    let personaDetails: Record<string, string> = {};
    if (bot.personaData) {
      try { personaDetails = JSON.parse(bot.personaData); } catch { /* ignore */ }
    }

    const isPerson = (bot.botType || "person") === "person";

    let prompt: string;

    if (isPerson) {
      // Build a detailed photorealistic portrait prompt from persona data
      const gender = personaDetails.gender || "";
      const ageRange = personaDetails.ageRange || "25-34";
      const appearance = personaDetails.appearance || "";
      const profession = personaDetails.profession || "";
      const location = personaDetails.location || "";

      const subjectDesc = [
        gender ? `${gender.toLowerCase()}` : "person",
        ageRange ? `aged ${ageRange}` : "",
        profession ? `who works as a ${profession}` : "",
        location ? `based in ${location}` : "",
      ].filter(Boolean).join(", ");

      const appearanceHint = appearance
        ? `Physical appearance: ${appearance}.`
        : "";

      const characterHint = bot.characterRefDescription
        ? `Character details: ${bot.characterRefDescription}.`
        : "";

      prompt = `Professional portrait photograph of a real ${subjectDesc}. ${appearanceHint} ${characterHint}

Shot on Canon EOS R5 with 85mm f/1.4 lens. Natural lighting, shallow depth of field with soft bokeh background. Head and shoulders framing, looking at camera with a natural expression. High-end editorial portrait photography style.

The person should look like a real human being — natural skin texture, realistic features, authentic expression. Think LinkedIn headshot meets editorial magazine portrait. Clean, simple background.

No illustrations, no digital art, no anime, no cartoon, no AI-looking artifacts. Ultra photorealistic. No text, no watermarks.`;
    } else {
      // Non-person bots: use art style for a stylized avatar
      const characterHint = bot.characterRefDescription
        ? `Based on this character: ${bot.characterRefDescription}`
        : `An iconic representation of "${bot.name}"`;

      const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

      prompt = `Create a profile picture / avatar for a content creator.
${characterHint}
Aesthetic: ${bot.aesthetic || "modern digital"}.
Art style: ${artStyleHint}.
Niche: ${bot.niche || "general"}.

Requirements:
- Render in ${artStyleHint} style
- Circular-crop friendly (centered subject)
- Bold, iconic, immediately recognizable at small sizes
- No text, no watermarks
- Single subject/entity, clean background or atmospheric backdrop
- Should feel like a distinctive social media profile picture`;
    }

    // Use Flux via fal.ai for high-quality image generation
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size: "square_hd",
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: false,
    }) as { data: { images?: { url?: string }[] } };

    const tempUrl = result.data?.images?.[0]?.url || null;
    if (!tempUrl) return null;

    if (!isStorageConfigured()) {
      console.warn("S3 not configured — avatar will NOT be stored. Set S3 env vars.");
      return null;
    }

    try {
      return await persistImage(tempUrl, "bots/avatars");
    } catch (err: any) {
      console.error("Failed to persist avatar to S3:", err.message);
      return null;
    }
  } catch (error: any) {
    console.error("Avatar generation failed:", error.message);
    return null;
  }
}


// ---------------------------------------------------------------------------
// Character reference analysis (GPT-4o Vision)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main post generation — MEDIA-FIRST, NO TEXT-ONLY
// ---------------------------------------------------------------------------

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
  const model = caps.premiumModel ? "gpt-4o" : "gpt-4o-mini";

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

  const characterContext = buildCharacterContext(bot);

  // Decide post type and video duration
  const postType = decidePostType(ownerTier);
  const videoDuration = postType === "VIDEO" ? pickVideoDuration(ownerTier) : undefined;

  // Build caption instruction based on format
  let captionInstruction: string;
  if (postType === "VIDEO" && videoDuration) {
    const videoStyle = VIDEO_STYLE_BY_DURATION[videoDuration] || VIDEO_STYLE_BY_DURATION[6];
    captionInstruction = `\n- This post is a ${videoStyle.label} VIDEO. Write a compelling caption (50-200 chars) that hooks viewers. ${
      videoDuration <= 6
        ? "Ultra-short — punchy, one idea, stop-scroll energy."
        : videoDuration <= 15
          ? "Short-form — hook + payoff, Reels/TikTok energy."
          : "Mini-story — cinematic, atmospheric, worth watching."
    }`;
  } else {
    captionInstruction = "\n- This post is an IMAGE post (Instagram style). Write a caption (50-300 chars) that works WITH a visual, not as standalone text. Be evocative, descriptive, and feed-stopping.";
  }

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
- NEVER use hashtags in the caption — tags are generated separately by the platform
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

  // Generate tags and media in parallel
  const tagsPromise = generateTags(bot, content, caps.trendAware, model);

  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;

  if (postType === "VIDEO" && videoDuration) {
    const video = await generateVideoContent(bot, content, videoDuration, caps.premiumModel);
    thumbnailUrl = video.thumbnailUrl || undefined;
    mediaUrl = video.videoUrl || video.thumbnailUrl || undefined;
  } else {
    const imageUrl = await generateImage(bot, content);
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

// ---------------------------------------------------------------------------
// Generate & publish (scheduler entrypoint)
// ---------------------------------------------------------------------------

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
        videoDuration: generated.videoDuration,
        tags: generated.tags,
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
