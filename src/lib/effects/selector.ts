// ---------------------------------------------------------------------------
// Effect Selector — picks the best effect for a bot's video post.
//
// Selection priority:
//   1. Match effect mood to caption sentiment
//   2. Filter by tier access
//   3. Weight toward effects the bot hasn't used recently (variety)
//   4. Prefer trending effects slightly
//   5. Respect bot personality (e.g. Dream would never pick "NPC Mode")
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { EffectRecord, EffectVariant, SelectedEffect } from "./types";
import { tierMeetsMinimum, mapSubscriptionTier } from "./types";
import { buildPrompt } from "./prompt-builder";

// ---------------------------------------------------------------------------
// Mood keywords → effect music mood mapping
// ---------------------------------------------------------------------------

const MOOD_MAP: Record<string, string[]> = {
  // Positive / upbeat
  happy: ["cruising_chill", "summer_chill", "golden_hour", "morning_calm", "morning_peaceful", "travel_excitement", "dance_beat", "runway_beat", "outfit_montage", "concert_energy"],
  energetic: ["action_intense", "chase_adrenaline", "combat_intense", "entrance_energy", "power_reveal", "chase_energy", "dramatic_bass_drop", "dj_set", "anime_opening", "speedrun"],
  confident: ["power_reveal", "dramatic_reveal", "entrance_energy", "runway_beat", "fashion_showcase", "main_character", "music_video_beat", "confidence_build"],
  chill: ["smooth_ambient", "late_night_drive", "morning_calm", "analog_warm", "late_night_focus", "journey_contemplative", "overhead_ambient", "ocean_calm", "studio_intimate"],
  funny: ["comedy_contrast", "game_ambient", "game_load", "speedrun", "caught", "plot_twist"],

  // Emotional / dramatic
  dramatic: ["dramatic_reveal", "emotional_build", "epic_ambient", "epic_contemplative", "epic_ascending", "ascending_reveal", "creation_build", "summit_triumph", "ascending_spiral"],
  moody: ["moody_atmospheric", "noir_jazz", "uncanny", "horror_tension", "descending_reveal", "time_suspension", "heist_planning", "western_tension"],
  melancholy: ["moody_atmospheric", "emotional_build", "journey_contemplative", "documentary"],
  inspiring: ["emotional_build", "summit_triumph", "epic_ascending", "ascending_spiral", "creation_build"],

  // Tech / futuristic
  tech: ["tech_magical", "sci_fi_ambient", "digital_materialization", "tech_analysis", "glitch_electronic", "dimensional_shift", "time_stop"],
  futuristic: ["sci_fi_ambient", "digital_materialization", "creation_build", "neon_wireframe", "time_stop"],
};

// Category → personality trait alignment
const CATEGORY_PERSONALITY_FIT: Record<string, string[]> = {
  cinematic_shots: ["dramatic", "artistic", "sophisticated", "creative"],
  action_dramatic: ["bold", "intense", "adventurous", "edgy", "chaotic"],
  lifestyle: ["relaxed", "authentic", "casual", "wholesome", "chill"],
  tech_futuristic: ["innovative", "analytical", "curious", "nerdy", "futuristic"],
  film_cinema: ["artistic", "creative", "dramatic", "sophisticated", "poetic"],
  drone_aerial: ["adventurous", "epic", "free", "nature", "travel"],
  fashion_luxury: ["stylish", "confident", "luxury", "bold", "glamorous"],
  travel_adventure: ["adventurous", "curious", "free", "explorer", "wanderlust"],
  music_performance: ["musical", "creative", "performer", "energetic", "passionate"],
  funny_viral: ["funny", "witty", "sarcastic", "chaotic", "relatable"],
};

// ---------------------------------------------------------------------------
// Sentiment analysis (simple keyword-based)
// ---------------------------------------------------------------------------

function analyzeMood(caption: string): string[] {
  const lower = caption.toLowerCase();
  const moods: string[] = [];

  if (/\b(haha|lol|lmao|😂|funny|joke|bruh)\b/.test(lower)) moods.push("funny");
  if (/\b(energy|hype|lets go|fire|🔥|lit|pump)\b/.test(lower)) moods.push("energetic");
  if (/\b(chill|relax|vibe|cozy|peace|calm|☕)\b/.test(lower)) moods.push("chill");
  if (/\b(sad|miss|gone|lost|rain|alone|dark)\b/.test(lower)) moods.push("melancholy");
  if (/\b(dream|inspire|believe|power|rise|king|queen)\b/.test(lower)) moods.push("inspiring");
  if (/\b(tech|code|ai|digital|cyber|data|algorithm)\b/.test(lower)) moods.push("tech");
  if (/\b(style|fashion|drip|outfit|fit|luxury|designer)\b/.test(lower)) moods.push("confident");
  if (/\b(drama|intense|epic|cinematic|war|battle)\b/.test(lower)) moods.push("dramatic");
  if (/\b(happy|love|amazing|beautiful|blessed|grateful)\b/.test(lower)) moods.push("happy");
  if (/\b(moody|noir|shadow|grit|raw|haunted)\b/.test(lower)) moods.push("moody");

  return moods.length > 0 ? moods : ["dramatic"]; // default
}

function personalityFit(personality: string, categoryId: string): number {
  const traits = CATEGORY_PERSONALITY_FIT[categoryId] || [];
  const lower = personality.toLowerCase();
  let matches = 0;
  for (const trait of traits) {
    if (lower.includes(trait)) matches++;
  }
  // 0 matches = 0.5 (neutral), 1+ = 0.7-1.0
  return matches === 0 ? 0.5 : Math.min(1.0, 0.7 + matches * 0.1);
}

// ---------------------------------------------------------------------------
// Main selector
// ---------------------------------------------------------------------------

export async function selectEffect(
  botId: string,
  caption: string,
  ownerTier: string,
  personality: string = "",
  videoDuration?: number,
): Promise<SelectedEffect | null> {
  const effectTier = mapSubscriptionTier(ownerTier);

  // 1. Get all active effects this tier can access
  const allEffects = await prisma.effect.findMany({
    where: { isActive: true },
  });

  const available = allEffects.filter((fx) =>
    tierMeetsMinimum(effectTier, fx.tierMinimum)
  ) as unknown as EffectRecord[];

  if (available.length === 0) return null;

  // 2. Get recent effects used by this bot (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentUsages = await prisma.botEffectUsage.findMany({
    where: { botId, createdAt: { gte: weekAgo } },
    select: { effectId: true },
  });
  const recentEffectIds = new Set(recentUsages.map((u) => u.effectId));

  // 3. Analyze caption mood
  const moods = analyzeMood(caption);
  const moodMoods = new Set(moods.flatMap((m) => MOOD_MAP[m] || []));

  // 4. Score each effect
  const scored: { effect: EffectRecord; score: number }[] = [];

  for (const effect of available) {
    let score = 1.0;

    // Mood match: +0.4 if the effect's music mood matches caption sentiment
    const musicMood = (effect.musicConfig as any)?.mood || "";
    if (moodMoods.has(musicMood)) score += 0.4;

    // Recency penalty: -0.5 if used in last 7 days
    if (recentEffectIds.has(effect.id)) score -= 0.5;

    // Trending bonus: +0.1
    if (effect.isTrending) score += 0.1;

    // Personality fit: 0.5-1.0 multiplier
    score *= personalityFit(personality, effect.categoryId);

    // Duration fit: slight preference for effects that support the requested duration
    if (videoDuration) {
      const durations = effect.durationOptions as number[];
      if (durations.includes(videoDuration)) score += 0.15;
    }

    // Multi-scene is more expensive — slight penalty for budget tiers
    if (effect.generationType === "multi_scene" && effectTier === "spark") {
      score -= 0.3;
    }

    scored.push({ effect, score: Math.max(0.05, score) });
  }

  // 5. Weighted random selection
  const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
  let roll = Math.random() * totalWeight;

  let selected = scored[0].effect;
  for (const { effect, score } of scored) {
    roll -= score;
    if (roll <= 0) {
      selected = effect;
      break;
    }
  }

  // 6. Pick a random variant (if available)
  const variants = (selected.variants as EffectVariant[] | null) || [];
  const variant = variants.length > 0
    ? variants[Math.floor(Math.random() * variants.length)]
    : null;

  // 7. Pick duration
  const durations = selected.durationOptions as number[];
  const duration = videoDuration && durations.includes(videoDuration)
    ? videoDuration
    : durations[Math.floor(Math.random() * durations.length)];

  // 8. Build the prompt
  const builtPrompt = buildPrompt(selected, variant);
  const scenes = selected.generationType === "multi_scene"
    ? buildMultiScenePrompts(selected, variant)
    : undefined;

  return { effect: selected, variant, duration, builtPrompt, scenes };
}

/** Build prompts for each scene of a multi-scene effect. */
function buildMultiScenePrompts(
  effect: EffectRecord,
  variant: EffectVariant | null,
): string[] {
  const template = effect.promptTemplate as { scenes?: string[] };
  if (!template.scenes) return [];

  return template.scenes.map((scene) => {
    let prompt = scene;
    if (variant?.substitutions) {
      for (const [key, value] of Object.entries(variant.substitutions)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
      }
    }
    return prompt;
  });
}

/** Record that a bot used an effect (for variety tracking + analytics). */
export async function recordEffectUsage(
  botId: string,
  effectId: string,
  variant?: string,
  generationCost?: number,
  postId?: string,
) {
  await prisma.$transaction([
    prisma.botEffectUsage.create({
      data: { botId, effectId, variant, generationCost, postId },
    }),
    prisma.effect.update({
      where: { id: effectId },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
}
