// Video generation module
// Handles fal.ai (Kling/Minimax) and Runway (Gen-3 Alpha) video generation with fallback.

import { fal, runway } from "./providers";
import { BotContext, ART_STYLE_PROMPTS, VIDEO_STYLE_BY_DURATION } from "./types";
import { generateImage } from "./image";

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

export async function generateVideoFal(
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

export async function generateVideoRunway(
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

export async function generateVideoContent(
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
