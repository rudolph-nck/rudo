// Character seed image generation — Flux 2 Pro via fal.ai
// Generates the initial character identity image(s) that all future images derive from.
// This is a one-time operation during bot creation (~$0.10-0.15 per seed).
//
// Supports all bot types: person, character, animal, entity (+ legacy realistic/fictional).

import { generateImage as falImage } from "../ai/providers/fal";
import { persistImage, isStorageConfigured } from "../media";
import type { SeedGenerationOptions, CharacterAppearance } from "./types";

// ---------------------------------------------------------------------------
// Prompt builders — one per bot type
// ---------------------------------------------------------------------------

function buildPersonDescription(
  appearance: CharacterAppearance | undefined,
  genderPresentation: string | undefined,
  ageRange: string | undefined,
  characterDescription?: string,
): string {
  const parts: string[] = [];

  const genderMap: Record<string, string> = {
    feminine: "woman",
    masculine: "man",
    fluid: "person",
  };
  parts.push(genderMap[genderPresentation || ""] || "person");

  const ageMap: Record<string, string> = {
    "18-24": "in their early 20s",
    "25-34": "in their late 20s to early 30s",
    "35-50+": "in their late 30s to 40s",
  };
  if (ageRange) parts.push(ageMap[ageRange] || "adult");

  if (appearance) {
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
    if (appearance.visualDescription) {
      parts.push(appearance.visualDescription);
    }
  }

  if (characterDescription) {
    parts.push(characterDescription);
  }

  return parts.join(", ");
}

function buildAnimalDescription(opts: SeedGenerationOptions): string {
  const parts: string[] = [];

  if (opts.breed) {
    parts.push(opts.breed);
  } else if (opts.species) {
    parts.push(opts.species);
  } else {
    parts.push("animal");
  }

  if (opts.animalSize) parts.push(`${opts.animalSize}-sized`);

  if (opts.appearance) {
    if (opts.appearance.furColor) parts.push(`${opts.appearance.furColor} fur`);
    if (opts.appearance.furPattern && opts.appearance.furPattern !== "solid") {
      parts.push(`${opts.appearance.furPattern} pattern`);
    }
    if (opts.appearance.markings) parts.push(`markings: ${opts.appearance.markings}`);
    if (opts.appearance.accessories) parts.push(`wearing ${opts.appearance.accessories}`);
    if (opts.appearance.visualDescription) parts.push(opts.appearance.visualDescription);
  }

  if (opts.characterDescription) parts.push(opts.characterDescription);

  return parts.join(", ");
}

function buildEntityDescription(opts: SeedGenerationOptions): string {
  const parts: string[] = [];

  if (opts.entityType) {
    const typeMap: Record<string, string> = {
      brand: "brand mascot character",
      food: "sentient food character",
      object: "anthropomorphic object character",
      place: "personified location character",
      concept: "abstract concept personified as a character",
      ai_being: "digital AI entity character",
    };
    parts.push(typeMap[opts.entityType] || "character");
  }

  if (opts.appearance?.visualDescription) parts.push(opts.appearance.visualDescription);
  if (opts.characterDescription) parts.push(opts.characterDescription);

  return parts.join(", ");
}

function buildSeedPrompt(opts: SeedGenerationOptions): string {
  const botType = opts.botType;
  const aesthetic = opts.aesthetic || "modern digital";
  const nicheCtx = opts.niche ? `Context: ${opts.niche} content creator.` : "";

  // --- Person (realistic human) ---
  if (botType === "person" || botType === "realistic") {
    const desc = buildPersonDescription(
      opts.appearance,
      opts.genderPresentation,
      opts.ageRange,
      opts.characterDescription,
    );
    return `Full body portrait photograph of a real ${desc}. Natural pose, authentic expression. Shot on Canon EOS R5, 85mm f/1.4, natural lighting. ${aesthetic} aesthetic. ${nicheCtx} Ultra photorealistic, natural skin texture, realistic features. Simple clean background. No text, no watermarks, no AI artifacts.`;
  }

  // --- Animal ---
  if (botType === "animal") {
    const desc = buildAnimalDescription(opts);
    return `Adorable full body portrait of a ${desc}. Expressive eyes, personality-filled pose. Name: "${opts.name}". ${aesthetic} aesthetic. ${nicheCtx} High quality, detailed, vibrant, character design quality. Clean background, centered subject. No text, no watermarks.`;
  }

  // --- Entity ---
  if (botType === "entity") {
    const desc = buildEntityDescription(opts);
    return `Creative character portrait of a ${desc}. Expressive, personality-filled, unique design. Name: "${opts.name}". ${aesthetic} aesthetic. ${nicheCtx} Bold visual design, high detail, character concept art quality. Clean background, centered subject. No text, no watermarks.`;
  }

  // --- Character (fictional/stylized humanoid) — also fallback for legacy "fictional" ---
  const desc = buildPersonDescription(
    opts.appearance,
    opts.genderPresentation,
    opts.ageRange,
    opts.characterDescription,
  );
  return `Full body character portrait of a ${desc}. Stylized, bold character design. Name: "${opts.name}". ${aesthetic} aesthetic. ${nicheCtx} Clean background, centered subject, high detail, character sheet quality. No text, no watermarks.`;
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
