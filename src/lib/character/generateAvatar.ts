// Contextual avatar generation using InstantCharacter (fal.ai)
// Given a seed image + bot context, generates scene-based avatars
// that show the character IN CONTEXT (not just a headshot).
//
// Example: a fitness bot's avatar shows them mid-workout,
// a food bot's avatar shows them in a kitchen.

import { fal } from "@fal-ai/client";
import { persistImage, isStorageConfigured } from "../media";
import type { AvatarGenerationOptions } from "./types";
import { NICHE_SCENE_MAP } from "./types";

// ---------------------------------------------------------------------------
// Scene builder
// ---------------------------------------------------------------------------

function buildAvatarScene(
  niche?: string,
  interests?: string[],
): string {
  // Try niche first
  if (niche) {
    const nicheKey = niche.toLowerCase().split(/[\s,/]+/)[0];
    const scene = NICHE_SCENE_MAP[nicheKey];
    if (scene) return scene;
  }

  // Try first interest
  if (interests?.length) {
    for (const interest of interests) {
      const scene = NICHE_SCENE_MAP[interest];
      if (scene) return scene;
    }
  }

  // Fallback
  return "casual urban setting, natural light, authentic moment";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate contextual avatar images using InstantCharacter.
 * The avatar shows the character in a scene relevant to their niche,
 * NOT just a generic headshot.
 *
 * @param opts - Seed URL and bot context
 * @returns Array of persisted avatar URLs (typically 3)
 */
export async function generateContextualAvatars(
  opts: AvatarGenerationOptions,
): Promise<string[]> {
  const count = opts.count ?? 3;
  const scene = buildAvatarScene(opts.niche, opts.interests);

  const prompt = `${opts.name}, ${scene}. Profile picture composition, centered subject, bold and iconic, immediately recognizable at small sizes. ${opts.aesthetic || "modern"} aesthetic. High quality, no text.`;

  const results: string[] = [];

  // Generate each avatar with InstantCharacter
  const promises = Array.from({ length: count }, () =>
    fal.subscribe("fal-ai/instant-character", {
      input: {
        prompt,
        image_url: opts.seedUrl,
        image_size: "square_hd",
      },
      logs: false,
    }).then((result: any) => {
      return result.data?.images?.[0]?.url || null;
    }).catch((err: any) => {
      console.error("Avatar generation via InstantCharacter failed:", err.message);
      return null;
    })
  );

  const tempUrls = await Promise.all(promises);

  if (!isStorageConfigured()) {
    console.warn("S3 not configured — avatars will NOT be persisted.");
    return tempUrls.filter((u): u is string => u !== null);
  }

  // Persist to S3
  const persistPromises = tempUrls
    .filter((u): u is string => u !== null)
    .map((url) =>
      persistImage(url, `bots/${opts.botId}/avatars`).catch((err) => {
        console.error("Failed to persist avatar:", err.message);
        return null;
      })
    );

  const persisted = await Promise.all(persistPromises);
  return persisted.filter((u): u is string => u !== null);
}

export { buildAvatarScene }; // Exported for testing
