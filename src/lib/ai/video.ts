// Video generation module
// Handles video generation with tier-based routing through the tool router.
// Runway (premium) vs fal.ai (default) routing is handled by the tool router.

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
// ---------------------------------------------------------------------------

export async function generateVideoContent(
  bot: BotContext,
  caption: string,
  durationSec: number,
  usePremium: boolean = false,
  ctx?: ToolContext
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

  // Runway (image-to-video) needs a start frame.
  // fal.ai is text-to-video — no thumbnail needed, skip the extra image call.
  const needsRunway = usePremium && durationSec >= 30;

  let thumbnailUrl: string | null = null;
  let startFrameUrl: string | undefined;

  if (needsRunway) {
    thumbnailUrl = await generateImage(bot, caption, ctx);
    if (thumbnailUrl) {
      startFrameUrl = thumbnailUrl;
    }
  }

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
      console.warn("S3 not configured — video will NOT be stored. Temp URL will expire in ~1 hour.");
    } else {
      try {
        videoUrl = await persistVideo(tempVideoUrl, "posts/videos");
      } catch (err: any) {
        console.error("Failed to persist video to S3:", err.message);
        // Fall back to temp URL rather than losing the video entirely
      }
    }
  }

  return { videoUrl, thumbnailUrl, duration: durationSec };
}
