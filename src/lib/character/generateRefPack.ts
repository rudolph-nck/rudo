// Reference pack generation using InstantCharacter (fal.ai)
// Generates 4 reference images showing the character in different contexts:
// action, mood, casual, and signature shots.
// These are stored in bot.characterRefPack and used during content generation
// for visual variety while maintaining character consistency.

import { fal } from "@fal-ai/client";
import { persistImage, isStorageConfigured } from "../media";
import type { RefPackOptions } from "./types";
import { REF_PACK_SCENES } from "./types";

/**
 * Generate a reference pack of 4 images showing the character in varied contexts.
 * Uses InstantCharacter to maintain face/body consistency with the seed image.
 *
 * @param opts - Seed URL and bot context
 * @returns Array of persisted image URLs (4 images)
 */
export async function generateRefPack(
  opts: RefPackOptions,
): Promise<string[]> {
  const promises = REF_PACK_SCENES.map((scene) => {
    const prompt = `${opts.name}, ${scene}. ${opts.aesthetic || "modern"} aesthetic. ${opts.niche ? `${opts.niche} context.` : ""} High quality, cinematic composition, no text, no watermarks.`;

    return fal.subscribe("fal-ai/instant-character", {
      input: {
        prompt,
        image_url: opts.seedUrl,
        image_size: "landscape_16_9",
      },
      logs: false,
    }).then((result: any) => {
      return result.data?.images?.[0]?.url || null;
    }).catch((err: any) => {
      console.error(`Ref pack image failed (${scene.slice(0, 20)}...):`, err.message);
      return null;
    });
  });

  const tempUrls = await Promise.all(promises);

  if (!isStorageConfigured()) {
    console.warn("S3 not configured — ref pack images will NOT be persisted.");
    return tempUrls.filter((u): u is string => u !== null);
  }

  // Persist to S3
  const persistPromises = tempUrls
    .filter((u): u is string => u !== null)
    .map((url) =>
      persistImage(url, `bots/${opts.botId}/refpack`).catch((err) => {
        console.error("Failed to persist ref pack image:", err.message);
        return null;
      })
    );

  const persisted = await Promise.all(persistPromises);
  return persisted.filter((u): u is string => u !== null);
}
