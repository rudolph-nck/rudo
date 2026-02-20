// Video generation module
// Handles video generation with tier-based routing through the tool router.
// Runway (premium) vs fal.ai (default) routing is handled by the tool router.
//
// Supports three video creation paths:
//   1. text_to_video (default) — single prompt → video
//   2. image_to_video (Runway) — generate start frame → image-to-video
//   3. start_end_frame — generate start frame from effect → image-to-video

import { generateVideo as routeVideo, type ToolContext, DEFAULT_CONTEXT } from "./tool-router";
import { BotContext, ART_STYLE_PROMPTS, VIDEO_STYLE_BY_DURATION } from "./types";
import { generateImage } from "./image";
import { persistVideo, isStorageConfigured } from "../media";

// ---------------------------------------------------------------------------
// Video content generation
// ---------------------------------------------------------------------------
//
// Routing strategy (handled by tool router):
//   SPARK/PULSE  → fal.ai (Kling for 6s, Minimax for 15s) — fast & cost-efficient
//   GRID 30s     → Runway Gen-3 Alpha Turbo — highest quality, premium tier only
//   Fallback     → If Runway fails, gracefully degrade to fal.ai Minimax
//
// start_end_frame effects:
//   Always generate a start frame image first (with IP-adapter for character
//   consistency), then use it as the start frame for image-to-video generation.
//   This works across all tiers — Runway for GRID, fal.ai for others.
// ---------------------------------------------------------------------------

export async function generateVideoContent(
  bot: BotContext,
  caption: string,
  durationSec: number,
  usePremium: boolean = false,
  ctx?: ToolContext,
  effectPrompt?: string,
  startFrameImagePrompt?: string,
): Promise<{ videoUrl: string | null; thumbnailUrl: string | null; duration: number }> {
  const style = VIDEO_STYLE_BY_DURATION[durationSec] || VIDEO_STYLE_BY_DURATION[6];

  const characterContext = bot.characterRefDescription
    ? `\nCharacter/Entity: ${bot.characterRefDescription}`
    : "";

  const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

  // Use effect prompt if provided, otherwise fall back to generic prompt
  const videoPrompt = effectPrompt
    ? `${effectPrompt}

Art style: ${artStyleHint}.

Requirements:
- Render in ${artStyleHint} style
- Vertical format (9:16), social media optimized
- No text overlays, no watermarks
- Cinematic quality, feed-stopping visual`
    : `${style.direction}

Creator: "${bot.name}" — ${bot.bio || "AI content creator"}.
Visual style: ${bot.aesthetic || "modern digital art"}, ${bot.niche || "general"} niche.
Art style: ${artStyleHint}.${characterContext}

Context: ${caption}

Requirements:
- Render in ${artStyleHint} style
- Vertical format (9:16), social media optimized
- No text overlays, no watermarks
- Cinematic quality, feed-stopping visual`;

  let thumbnailUrl: string | null = null;
  let startFrameUrl: string | undefined;

  // Path A: start_end_frame effect — always generate a start frame image.
  // The start frame uses IP-adapter (character ref) for visual consistency,
  // giving us a grounded first frame that the video model transitions FROM.
  if (startFrameImagePrompt) {
    console.log(`[Video] @${bot.handle}: generating start frame for start_end_frame effect`);
    thumbnailUrl = await generateStartFrame(bot, startFrameImagePrompt, ctx);
    if (thumbnailUrl) {
      startFrameUrl = thumbnailUrl;
    }
  }
  // Path B: Runway premium (GRID 30s) — generate start frame from caption
  else if (usePremium && durationSec >= 30) {
    thumbnailUrl = await generateImage(bot, caption, ctx);
    if (thumbnailUrl) {
      startFrameUrl = thumbnailUrl;
    }
  }
  // Path C: text-to-video (default) — no start frame needed

  const tempVideoUrl = await routeVideo(
    {
      prompt: videoPrompt,
      durationSec,
      startFrameUrl,
    },
    ctx || DEFAULT_CONTEXT,
  );

  // Persist video to S3 (same pattern as image.ts)
  let videoUrl: string | null = tempVideoUrl;
  if (tempVideoUrl) {
    if (!isStorageConfigured()) {
      console.warn(`S3 not configured — video for @${bot.handle} will NOT be stored. Temp URL will expire in ~1 hour.`);
    } else {
      try {
        videoUrl = await persistVideo(tempVideoUrl, "posts/videos");
      } catch (err: any) {
        console.error(`Failed to persist video to S3 for @${bot.handle}:`, err.message, "| tempUrl:", tempVideoUrl.slice(0, 100));
        // Fall back to temp URL rather than losing the video entirely
      }
    }
  } else {
    console.error(`Video generation returned null for bot @${bot.handle} (${durationSec}s, premium=${usePremium})`);
  }

  return { videoUrl, thumbnailUrl, duration: durationSec };
}

// ---------------------------------------------------------------------------
// Start frame generation for start_end_frame effects
// ---------------------------------------------------------------------------
//
// Uses the same image generation pipeline as regular images — including
// IP-adapter grounding from the bot's avatar/character reference — but
// with a specific scene description from the effect's cameraConfig.startFrame.
// ---------------------------------------------------------------------------

import {
  generateImage as routeImage,
  DEFAULT_CONTEXT as IMG_DEFAULT,
} from "./tool-router";
import { persistImage, isStorageConfigured as isS3Configured } from "../media";

async function generateStartFrame(
  bot: BotContext,
  scenePrompt: string,
  ctx?: ToolContext,
): Promise<string | null> {
  try {
    const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

    // Inject character context into the scene prompt
    let characterHint = "";
    if (bot.characterRefDescription) {
      characterHint = `\nCharacter/Entity in scene: ${bot.characterRefDescription}`;
    }

    const imagePrompt = `${scenePrompt}${characterHint}

Art style: ${artStyleHint}.
This is a single frame from a cinematic video — it should look like a film still.
High quality, dramatic composition, vertical format (9:16).
No text overlays, no watermarks.`;

    // Use avatar/character ref as IP-adapter reference for visual consistency
    const refImageUrl = bot.characterRef || bot.avatar;

    const tempUrl = await routeImage(
      {
        prompt: imagePrompt,
        referenceImageUrl: refImageUrl || undefined,
        imageSize: "portrait_4_3",
      },
      ctx || IMG_DEFAULT,
    );

    if (!tempUrl) return null;

    if (!isS3Configured()) {
      console.warn(`S3 not configured — start frame for @${bot.handle} will NOT be stored.`);
      return null;
    }

    return await persistImage(tempUrl, "posts/frames");
  } catch (err: any) {
    console.error(`Start frame generation failed for @${bot.handle}:`, err.message);
    return null;
  }
}
