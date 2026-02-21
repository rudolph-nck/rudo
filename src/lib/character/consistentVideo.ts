// Consistent video generation — generates a still frame with InstantCharacter
// then animates it with Kling v2/MiniMax via fal.ai.
// This ensures the character's face/body remains consistent even in video.
//
// Pipeline: seed image -> InstantCharacter still -> image-to-video animation
//
// Duration routing:
//   <=6s  -> fal-ai/kling-video/v2/master/image-to-video
//   <=15s -> fal-ai/minimax-video/image-to-video
//   <=30s -> fal-ai/kling-video/v2/master/image-to-video (or Runway fallback)

import { fal } from "@fal-ai/client";
import { persistImage, isStorageConfigured } from "../media";
import type { ConsistentVideoOptions } from "./types";

const DURATION_MODELS: Record<number, string> = {
  6:  "fal-ai/kling-video/v2/master/image-to-video",
  15: "fal-ai/minimax-video/image-to-video",
  30: "fal-ai/kling-video/v2/master/image-to-video",
};

/**
 * Generate a character-consistent video.
 * 1. Generates a consistent still frame using InstantCharacter
 * 2. Animates the still with image-to-video (Kling or MiniMax)
 *
 * @param opts - Seed URL, motion prompt, and duration
 * @returns Object with videoUrl and thumbnailUrl, or null on failure
 */
export async function generateConsistentVideo(
  opts: ConsistentVideoOptions,
): Promise<{ videoUrl: string; thumbnailUrl: string | null } | null> {
  try {
    // Step 1: Generate consistent still frame
    const stillResult = await fal.subscribe("fal-ai/instant-character", {
      input: {
        prompt: `${opts.motionPrompt}. Starting frame, cinematic composition, ready for animation.`,
        image_url: opts.seedUrl,
        image_size: "landscape_16_9",
      },
      logs: false,
    }) as any;

    const stillUrl = stillResult.data?.images?.[0]?.url || null;
    if (!stillUrl) {
      console.error("InstantCharacter failed to generate still frame for video");
      return null;
    }

    // Persist the still as thumbnail
    let thumbnailUrl: string | null = null;
    if (isStorageConfigured()) {
      thumbnailUrl = await persistImage(stillUrl, "posts/thumbnails").catch(() => null);
    }

    // Step 2: Animate with image-to-video
    const model = DURATION_MODELS[opts.duration] || DURATION_MODELS[6];
    const durationParam = opts.duration <= 6 ? "5" : "10";

    const videoResult = await fal.subscribe(model, {
      input: {
        prompt: opts.motionPrompt,
        image_url: stillUrl,
        duration: durationParam,
        aspect_ratio: "9:16",
      },
      logs: false,
    }) as any;

    const videoUrl = videoResult.data?.video?.url || videoResult.data?.video_url || null;
    if (!videoUrl) {
      console.error("Image-to-video animation failed — no video URL returned");
      return thumbnailUrl ? { videoUrl: "", thumbnailUrl } : null;
    }

    return { videoUrl, thumbnailUrl };
  } catch (error: any) {
    console.error("Consistent video generation failed:", error.message);
    return null;
  }
}
