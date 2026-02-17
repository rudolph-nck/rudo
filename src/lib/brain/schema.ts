// Zod validation for CharacterBrain
// Clamps 0..1, normalizes pillar weights, validates enums.

import { z } from "zod";
import type { CharacterBrain } from "./types";

const unit = z.number().min(0).max(1).transform((v) => Math.max(0, Math.min(1, v)));

const safeguardPolicy = z.enum(["block", "cautious", "allow"]);
const sentenceLength = z.enum(["short", "medium", "long"]);

const brainSchema = z.object({
  version: z.number().int().positive(),

  traits: z.object({
    humor: unit,
    sarcasm: unit,
    warmth: unit,
    empathy: unit,
    confidence: unit,
    assertiveness: unit,
    curiosity: unit,
    creativity: unit,
    chaos: unit,
    formality: unit,
    verbosity: unit,
    optimism: unit,
    controversyAvoidance: unit,
  }),

  style: z.object({
    emojiRate: unit,
    punctuationEnergy: unit,
    hookiness: unit,
    metaphorRate: unit,
    ctaRate: unit,
    sentenceLength,
  }),

  contentBias: z.object({
    pillars: z.record(z.string(), z.number().min(0)),
    pacing: unit,
    visualMood: unit,
  }),

  safeguards: z.object({
    sexual: safeguardPolicy,
    violence: safeguardPolicy,
    politics: safeguardPolicy,
    personalData: safeguardPolicy,
  }),
});

/**
 * Normalize pillar weights so they sum to 1.
 * If all weights are 0, distribute evenly.
 */
function normalizePillars(pillars: Record<string, number>): Record<string, number> {
  const entries = Object.entries(pillars);
  if (entries.length === 0) return {};

  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total === 0) {
    const even = 1 / entries.length;
    return Object.fromEntries(entries.map(([k]) => [k, even]));
  }

  return Object.fromEntries(entries.map(([k, w]) => [k, Math.max(0, w) / total]));
}

/**
 * Validate and clamp a brain object.
 * Returns a fully valid CharacterBrain or throws on structural errors.
 */
export function validateBrain(brain: unknown): CharacterBrain {
  const parsed = brainSchema.parse(brain);

  // Normalize pillar weights
  parsed.contentBias.pillars = normalizePillars(parsed.contentBias.pillars);

  return parsed as CharacterBrain;
}
