// Character seed image generation — Flux 2 Pro via fal.ai
// Generates the initial character identity image(s) that all future images derive from.
// This is a one-time operation during bot creation (~$0.10-0.15 per seed).

import { generateImage as falImage } from "../ai/providers/fal";
import { persistImage, isStorageConfigured } from "../media";
import type { SeedGenerationOptions, CharacterAppearance } from "./types";

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildAppearanceDescription(
  appearance: CharacterAppearance | undefined,
  genderPresentation: string,
  ageRange: string,
): string {
  const parts: string[] = [];

  // Gender and age
  const genderMap: Record<string, string> = {
    feminine: "woman",
    masculine: "man",
    fluid: "person",
  };
  parts.push(genderMap[genderPresentation] || "person");

  const ageMap: Record<string, string> = {
    "18-24": "in their early 20s",
    "25-34": "in their late 20s to early 30s",
    "35-50+": "in their late 30s to 40s",
  };
  parts.push(ageMap[ageRange] || "adult");

  if (!appearance) return parts.join(", ");

  if (appearance.skinTone) parts.push(`${appearance.skinTone} skin`);
  if (appearance.hairColor && appearance.hairStyle) {
    parts.push(`${appearance.hairColor} ${appearance.hairStyle} hair`);
  } else if (appearance.hairColor) {
    parts.push(`${appearance.hairColor} hair`);
  } else if (appearance.hairStyle) {
    parts.push(`${appearance.hairStyle} hair`);
  }
  if (appearance.build) parts.push(`${appearance.build} build`);
  if (appearance.styleKeywords?.length) {
    parts.push(`style: ${appearance.styleKeywords.join(", ")}`);
  }
  if (appearance.distinguishingFeature) {
    parts.push(`distinctive feature: ${appearance.distinguishingFeature}`);
  }

  return parts.join(", ");
}

function buildSeedPrompt(opts: SeedGenerationOptions): string {
  const desc = buildAppearanceDescription(
    opts.appearance,
    opts.genderPresentation,
    opts.ageRange,
  );

  if (opts.botType === "fictional") {
    return `Full body character portrait of a ${desc}. Stylized, bold character design. Name: "${opts.name}". ${opts.aesthetic || "modern digital"} aesthetic. ${opts.niche ? `World: ${opts.niche}.` : ""} Clean background, centered subject, high detail, character sheet quality. No text, no watermarks.`;
  }

  // Realistic
  return `Full body portrait photograph of a real ${desc}. Natural pose, authentic expression. Shot on Canon EOS R5, 85mm f/1.4, natural lighting. ${opts.aesthetic || "clean modern"} aesthetic. ${opts.niche ? `Context: ${opts.niche} content creator.` : ""} Ultra photorealistic, natural skin texture, realistic features. Simple clean background. No text, no watermarks, no AI artifacts.`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate seed character images using Flux 2 Pro via fal.ai.
 * Returns an array of image URLs for the user to choose from.
 *
 * @param opts - Character appearance and identity data from wizard
 * @returns Array of persisted image URLs (typically 4)
 */
export async function generateSeedImages(
  opts: SeedGenerationOptions,
): Promise<string[]> {
  const count = opts.count ?? 4;
  const prompt = buildSeedPrompt(opts);

  const results: string[] = [];

  // Generate images in parallel (each is an independent fal.ai call)
  const promises = Array.from({ length: count }, () =>
    falImage({
      model: "fal-ai/flux-pro/v1.1",
      prompt,
      image_size: "portrait_4_3",
    }).catch((err) => {
      console.error("Seed image generation failed:", err.message);
      return null;
    })
  );

  const tempUrls = await Promise.all(promises);

  if (!isStorageConfigured()) {
    console.warn("S3 not configured — seed images will NOT be persisted.");
    return tempUrls.filter((u): u is string => u !== null);
  }

  // Persist to S3 in parallel
  const persistPromises = tempUrls
    .filter((u): u is string => u !== null)
    .map((url) =>
      persistImage(url, `bots/${opts.botId}/seeds`).catch((err) => {
        console.error("Failed to persist seed image:", err.message);
        return null;
      })
    );

  const persisted = await Promise.all(persistPromises);
  return persisted.filter((u): u is string => u !== null);
}

export { buildSeedPrompt }; // Exported for testing
