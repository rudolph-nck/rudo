// Shared types and constants for the AI generation pipeline
// These are used across caption, image, video, and orchestration modules.

export type BotContext = {
  name: string;
  handle: string;
  personality: string | null;
  contentStyle: string | null;
  niche: string | null;
  tone: string | null;
  aesthetic: string | null;
  artStyle: string | null;
  bio: string | null;
  avatar: string | null;
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

export const TIER_CAPABILITIES: Record<string, {
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
  ADMIN: {
    videoChance: 0.55,
    videoDurationMix: [
      { duration: 6, weight: 0.45 },
      { duration: 15, weight: 0.47 },
      { duration: 30, weight: 0.08 },
    ],
    premiumModel: true,
    trendAware: true,
    canUploadCharacterRef: true,
  },
};

// ---------------------------------------------------------------------------
// Video creative direction by duration
// ---------------------------------------------------------------------------

export const VIDEO_STYLE_BY_DURATION: Record<number, { label: string; direction: string }> = {
  6:  { label: "6-second hook", direction: "A single punchy moment — one striking visual transition, one dramatic reveal, or one mesmerizing loop. Think \"stop-scroll\" energy. No narrative arc needed, just pure visual impact." },
  15: { label: "15-second short", direction: "A mini-sequence with a beginning and payoff — establish a mood, build tension, deliver a moment. Think Instagram Reels / TikTok standard. Quick cuts or one fluid camera move." },
  30: { label: "30-second story", direction: "A micro-narrative with setup, development, and resolution. Think cinematic short — atmospheric establishing shot, character/subject action, and a memorable closing frame. Allow the visual to breathe." },
};

// ---------------------------------------------------------------------------
// Art style rendering instructions
// ---------------------------------------------------------------------------

export const ART_STYLE_PROMPTS: Record<string, string> = {
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
// Content type decisions
// ---------------------------------------------------------------------------

/**
 * Decide IMAGE or VIDEO. No text-only posts — ever.
 */
export function decidePostType(tier: string): "IMAGE" | "VIDEO" {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;
  return Math.random() < caps.videoChance ? "VIDEO" : "IMAGE";
}

/**
 * Pick a video duration from the tier's weighted mix.
 * e.g. GRID might roll 6s (30%), 15s (40%), or 30s (30%).
 */
export function pickVideoDuration(tier: string): number {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;
  const roll = Math.random();
  let cumulative = 0;
  for (const { duration, weight } of caps.videoDurationMix) {
    cumulative += weight;
    if (roll < cumulative) return duration;
  }
  return caps.videoDurationMix[0].duration;
}
