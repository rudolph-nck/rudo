// Consistent image generation — every post image uses InstantCharacter
// to maintain character face/body consistency across all generated content.
// Replaces direct DALL-E 3 / Flux calls for bots that have a seed image.

import { fal } from "@fal-ai/client";
import { persistImage, isStorageConfigured } from "../media";
import type { ConsistentImageOptions } from "./types";

/**
 * Generate a character-consistent image for a post.
 * Uses fal-ai/instant-character with the bot's seed image as identity anchor.
 *
 * For bots WITHOUT a seed image, callers should fall back to the standard
 * image generation in src/lib/ai/image.ts.
 *
 * @param opts - Seed URL and scene prompt
 * @returns Persisted image URL, or null on failure
 */
export async function generateConsistentImage(
  opts: ConsistentImageOptions,
): Promise<string | null> {
  try {
    const result = await fal.subscribe("fal-ai/instant-character", {
      input: {
        prompt: opts.scenePrompt,
        image_url: opts.seedUrl,
        image_size: (opts.imageSize || "square_hd") as "square_hd",
      },
      logs: false,
    }) as any;

    const tempUrl = result.data?.images?.[0]?.url || null;
    if (!tempUrl) {
      console.error("InstantCharacter returned no image for consistent generation");
      return null;
    }

    if (!isStorageConfigured()) {
      console.warn("S3 not configured — consistent image will NOT be persisted.");
      return null;
    }

    return await persistImage(tempUrl, "posts/images");
  } catch (error: any) {
    console.error("Consistent image generation failed:", error.message);
    return null;
  }
}
