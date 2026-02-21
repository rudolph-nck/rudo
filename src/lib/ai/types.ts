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
  // Character consistency system
  characterSeedUrl: string | null;
  characterFaceUrl: string | null;
  characterRefPack: string[] | unknown | null;
  // Voice & talking head
  voiceId: string | null;
  // Content rating
  contentRating: string | null;
  // Effect profile
  effectProfile: BotEffectProfile | unknown | null;
};

export type BotEffectProfile = {
  signatureEffectId: string;
  rotationEffectIds: string[];
  explorationRate: number;
};

// ---------------------------------------------------------------------------
// Tier capabilities & content mix
// ---------------------------------------------------------------------------
// Three post types: TEXT, IMAGE, VIDEO.
//   TEXT  = Twitter-style captions, cheapest (~0.15¢), highly reliable.
//   IMAGE = Visual post with AI-generated image (Flux).
//   VIDEO = Short-form video (Kling/Minimax/Runway).
//
// TEXT posts also serve as the fallback when media generation fails,
// so bots always publish something rather than silently skipping.
//
// Duration calibration (current AI video gen ceilings):
//   6s  = single generation, punchy hook (Kling native)
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
  styledTextChance: number;
  videoChance: number;
  videoDurationMix: { duration: number; weight: number }[];
  premiumModel: boolean;
  trendAware: boolean;
  canUploadCharacterRef: boolean;
  /** @deprecated Use styledTextChance instead. Kept for backward compat. */
  textChance: number;
}> = {
  SPARK: {
    styledTextChance: 0.10,          // 10% styled text
    videoChance: 0.40,               // 40% video, remaining 50% = IMAGE
    videoDurationMix: [{ duration: 6, weight: 1.0 }],
    premiumModel: false,
    trendAware: false,
    canUploadCharacterRef: false,
    textChance: 0.10,
  },
  PULSE: {
    styledTextChance: 0.08,          // 8% styled text
    videoChance: 0.50,               // 50% video, remaining 42% = IMAGE
    videoDurationMix: [
      { duration: 6, weight: 0.65 },   // 65% quick hooks (cost-efficient)
      { duration: 15, weight: 0.35 },   // 35% short-form (signature format)
    ],
    premiumModel: false,
    trendAware: true,
    canUploadCharacterRef: false,
    textChance: 0.08,
  },
  GRID: {
    styledTextChance: 0.05,          // 5% styled text
    videoChance: 0.60,               // 60% video, remaining 35% = IMAGE
    videoDurationMix: [
      { duration: 6, weight: 0.45 },    // 45% quick hooks (cost-efficient)
      { duration: 15, weight: 0.47 },   // 47% short-form
      { duration: 30, weight: 0.08 },   // 8% premium stories (~1-2/week/bot)
    ],
    premiumModel: true,
    trendAware: true,
    canUploadCharacterRef: true,
    textChance: 0.05,
  },
  ADMIN: {
    styledTextChance: 0.05,
    videoChance: 0.60,
    videoDurationMix: [
      { duration: 6, weight: 0.45 },
      { duration: 15, weight: 0.47 },
      { duration: 30, weight: 0.08 },
    ],
    premiumModel: true,
    trendAware: true,
    canUploadCharacterRef: true,
    textChance: 0.05,
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
 * Decide STYLED_TEXT, IMAGE, or VIDEO.
 * No plain TEXT posts — STYLED_TEXT = text overlaid on generated background image.
 * If formatWeights from BotStrategy are provided, they bias the decision.
 */
export function decidePostType(
  tier: string,
  formatWeights?: Record<string, number>
): "STYLED_TEXT" | "IMAGE" | "VIDEO" {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;
  let styledTextChance = caps.styledTextChance;
  let videoChance = caps.videoChance;

  // Apply learned format bias (max ±0.15 swing to keep it bounded).
  if (formatWeights && Object.keys(formatWeights).length > 0) {
    const styledTextWeight = formatWeights["STYLED_TEXT"] || formatWeights["TEXT"] || 0;
    const imageWeight = formatWeights["IMAGE"] || 0;
    const videoWeight = Math.max(
      formatWeights["VIDEO_6"] || 0,
      formatWeights["VIDEO_15"] || 0,
      formatWeights["VIDEO_30"] || 0
    );

    const styledTextBias = Math.max(-0.05, Math.min(0.05, (styledTextWeight - imageWeight) * 0.1));
    styledTextChance = Math.max(0.02, Math.min(0.20, styledTextChance + styledTextBias));

    const videoBias = Math.max(-0.15, Math.min(0.15, (videoWeight - imageWeight) * 0.2));
    videoChance = Math.max(0, Math.min(0.75, videoChance + videoBias));
  }

  const roll = Math.random();
  if (roll < styledTextChance) return "STYLED_TEXT";
  if (roll < styledTextChance + videoChance) return "VIDEO";
  return "IMAGE";
}

/**
 * Pick a video duration from the tier's weighted mix.
 * e.g. GRID might roll 6s (30%), 15s (40%), or 30s (30%).
 * If formatWeights from BotStrategy are provided, they bias duration selection.
 */
export function pickVideoDuration(
  tier: string,
  formatWeights?: Record<string, number>
): number {
  const caps = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.SPARK;

  // Apply learned duration bias
  let mix = caps.videoDurationMix;
  if (formatWeights && Object.keys(formatWeights).length > 0) {
    const total = mix.reduce((s, m) => s + m.weight, 0);
    mix = mix.map((m) => {
      const key = `VIDEO_${m.duration}`;
      const boost = (formatWeights[key] || 0) * 0.15; // max ±0.15 shift
      return { duration: m.duration, weight: Math.max(0.05, m.weight + boost) };
    });
    // Re-normalize to sum to original total
    const newTotal = mix.reduce((s, m) => s + m.weight, 0);
    if (newTotal > 0) {
      mix = mix.map((m) => ({ duration: m.duration, weight: (m.weight / newTotal) * total }));
    }
  }

  const roll = Math.random();
  let cumulative = 0;
  for (const { duration, weight } of mix) {
    cumulative += weight;
    if (roll < cumulative) return duration;
  }
  return mix[0].duration;
}
