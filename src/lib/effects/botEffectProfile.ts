// Bot Effect Profile — assigns a signature effect + rotation effects to each bot.
// The profile determines which effects a bot uses most often, creating a
// recognizable visual identity across their content.
//
// Each bot gets:
//   - signatureEffect: used ~25-30% of the time (their "brand")
//   - rotationEffects: 3-5 effects they use regularly
//   - explorationRate: % chance to try something new (from brain.traits.curiosity)
//
// Assignment is deterministic per bot ID — same bot always gets the same profile
// given the same available effects.

import { prisma } from "@/lib/prisma";
import { mapSubscriptionTier, tierMeetsMinimum } from "./types";
import type { BotEffectProfile } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Personality -> category affinity mapping
// ---------------------------------------------------------------------------

const PERSONALITY_CATEGORY_MAP: Record<string, string[]> = {
  humor:        ["funny_viral", "lifestyle"],
  warmth:       ["lifestyle", "travel_adventure"],
  confidence:   ["fashion_luxury", "cinematic_shots"],
  creativity:   ["film_cinema", "tech_futuristic"],
  chaos:        ["funny_viral", "action_dramatic"],
  curiosity:    ["tech_futuristic", "drone_aerial", "travel_adventure"],
  assertiveness: ["action_dramatic", "cinematic_shots"],
  optimism:     ["lifestyle", "travel_adventure", "music_performance"],
};

// Niche -> preferred categories
const NICHE_CATEGORY_MAP: Record<string, string[]> = {
  comedy:       ["funny_viral", "lifestyle"],
  fitness:      ["action_dramatic", "lifestyle"],
  food:         ["lifestyle", "cinematic_shots"],
  travel:       ["travel_adventure", "drone_aerial"],
  gaming:       ["tech_futuristic", "action_dramatic"],
  music:        ["music_performance", "cinematic_shots"],
  fashion:      ["fashion_luxury", "cinematic_shots"],
  tech:         ["tech_futuristic", "film_cinema"],
  photography:  ["cinematic_shots", "drone_aerial"],
  art:          ["film_cinema", "cinematic_shots"],
  film:         ["film_cinema", "cinematic_shots"],
  sports:       ["action_dramatic", "drone_aerial"],
  nature:       ["drone_aerial", "travel_adventure"],
  nightlife:    ["music_performance", "fashion_luxury"],
  business:     ["cinematic_shots", "tech_futuristic"],
};

// ---------------------------------------------------------------------------
// Seeded random (same as brain compiler)
// ---------------------------------------------------------------------------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}

function seededRandom(botId: string, salt: string): number {
  const seed = hashCode(`${botId}:effect:${salt}`);
  return Math.abs(seed % 10000) / 10000;
}

function seededShuffle<T>(arr: T[], botId: string, salt: string): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(botId, `${salt}:${i}`) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Main assignment
// ---------------------------------------------------------------------------

/**
 * Assign an effect profile to a bot based on their personality traits and niche.
 * Deterministic per bot ID — same bot always gets the same profile.
 *
 * @param botId - The bot's unique ID
 * @param ownerTier - Owner's subscription tier
 * @param traits - Brain personality traits (if available)
 * @param niche - Bot's content niche (if available)
 * @returns BotEffectProfile with signature + rotation effects
 */
export async function assignEffectProfile(
  botId: string,
  ownerTier: string,
  traits?: Record<string, number>,
  niche?: string,
): Promise<BotEffectProfile> {
  const effectTier = mapSubscriptionTier(ownerTier);

  // Get all active effects this tier can access
  const allEffects = await prisma.effect.findMany({
    where: { isActive: true },
    select: { id: true, categoryId: true, tierMinimum: true },
  });

  const available = allEffects.filter((fx) =>
    tierMeetsMinimum(effectTier, fx.tierMinimum)
  );

  if (available.length === 0) {
    return {
      signatureEffectId: "",
      rotationEffectIds: [],
      explorationRate: 0.15,
    };
  }

  // Score effects by personality + niche affinity
  const scores: Map<string, number> = new Map();

  for (const fx of available) {
    let score = 1.0;

    // Personality affinity
    if (traits) {
      for (const [trait, traitValue] of Object.entries(traits)) {
        const categories = PERSONALITY_CATEGORY_MAP[trait];
        if (categories?.includes(fx.categoryId) && traitValue > 0.6) {
          score += traitValue * 0.5;
        }
      }
    }

    // Niche affinity
    if (niche) {
      const nicheKey = niche.toLowerCase().split(/[\s,/]+/)[0];
      const nicheCategories = NICHE_CATEGORY_MAP[nicheKey];
      if (nicheCategories?.includes(fx.categoryId)) {
        score += 0.8;
      }
    }

    scores.set(fx.id, score);
  }

  // Sort by score (deterministic tiebreaker using botId)
  const sorted = [...available].sort((a, b) => {
    const scoreA = scores.get(a.id) || 0;
    const scoreB = scores.get(b.id) || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Deterministic tiebreaker
    return hashCode(`${botId}:${a.id}`) - hashCode(`${botId}:${b.id}`);
  });

  // Signature effect = top scorer
  const signatureEffectId = sorted[0].id;

  // Rotation effects = next 3-5 from shuffled top scorers
  const candidates = sorted.slice(1, 15); // top 15 minus signature
  const shuffled = seededShuffle(candidates, botId, "rotation");
  const rotationCount = 3 + Math.floor(seededRandom(botId, "rotationCount") * 3); // 3-5
  const rotationEffectIds = shuffled.slice(0, rotationCount).map((fx) => fx.id);

  // Exploration rate based on curiosity trait
  const curiosity = traits?.curiosity ?? 0.5;
  const explorationRate = Math.max(0.05, Math.min(0.30, curiosity * 0.3));

  return {
    signatureEffectId,
    rotationEffectIds,
    explorationRate,
  };
}

/**
 * Select an effect for a post based on the bot's effect profile.
 * Uses the profile to weight signature vs rotation vs exploration.
 *
 * @param profile - The bot's effect profile
 * @returns Effect ID to use, or null to use standard effect selection
 */
export function pickEffectFromProfile(
  profile: BotEffectProfile,
): string | null {
  if (!profile.signatureEffectId && profile.rotationEffectIds.length === 0) {
    return null;
  }

  const roll = Math.random();

  // ~25-30% chance: use signature effect
  if (roll < 0.28 && profile.signatureEffectId) {
    return profile.signatureEffectId;
  }

  // explorationRate% chance: return null (let standard selector pick)
  if (roll < 0.28 + profile.explorationRate) {
    return null;
  }

  // Otherwise: pick from rotation
  if (profile.rotationEffectIds.length > 0) {
    const idx = Math.floor(Math.random() * profile.rotationEffectIds.length);
    return profile.rotationEffectIds[idx];
  }

  return profile.signatureEffectId || null;
}
