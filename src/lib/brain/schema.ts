// Zod validation for CharacterBrain
// Clamps 0..1, normalizes pillar weights, validates enums.

import { z } from "zod";
import type { CharacterBrain } from "./types";

const unit = z.number().min(0).max(1).transform((v) => Math.max(0, Math.min(1, v)));

const safeguardPolicy = z.enum(["block", "cautious", "allow"]);
const sentenceLength = z.enum(["short", "medium", "long"]);
const cognitiveArchetype = z.enum([
  "analytical", "emotional", "impulsive", "observational", "storyteller", "provocateur",
]);

const convictionSchema = z.object({
  topic: z.string().min(1).max(100),
  stance: z.string().min(1).max(300),
  intensity: unit,
  willVoice: unit,
});

const vocabularySchema = z.object({
  preferred: z.array(z.string().max(60)).max(25).optional().default([]),
  banned: z.array(z.string().max(60)).max(25).optional().default([]),
  fillers: z.array(z.string().max(30)).max(10).optional().default([]),
  slangLevel: unit.optional().default(0.5),
});

const cognitiveStyleSchema = z.object({
  archetype: cognitiveArchetype.optional().default("emotional"),
  thinkingPattern: z.string().max(500).optional().default(""),
});

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
    minimalPostRate: unit.optional().default(0.15),
  }),

  contentBias: z.object({
    pillars: z.record(z.string(), z.number().min(0)),
    pacing: unit,
    visualMood: unit,
  }),

  vocabulary: vocabularySchema.optional().default({
    preferred: [], banned: [], fillers: [], slangLevel: 0.5,
  }),

  cognitiveStyle: cognitiveStyleSchema.optional().default({
    archetype: "emotional", thinkingPattern: "",
  }),

  convictions: z.array(convictionSchema).max(10).optional().default([]),

  voiceExamples: z.array(z.string().max(500)).max(12).optional().default([]),

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
 * Handles v1/v2 brains by providing defaults for new v3 fields.
 */
export function validateBrain(brain: unknown): CharacterBrain {
  // Handle older brains missing newer fields
  const raw = brain as Record<string, any>;
  if (raw && typeof raw === "object") {
    if (!raw.convictions) raw.convictions = [];
    if (!raw.voiceExamples) raw.voiceExamples = [];
    if (raw.style && raw.style.minimalPostRate === undefined) {
      raw.style.minimalPostRate = 0.15;
    }
    // v3 fields: vocabulary + cognitiveStyle
    if (!raw.vocabulary) {
      raw.vocabulary = { preferred: [], banned: [], fillers: [], slangLevel: 0.5 };
    }
    if (!raw.cognitiveStyle) {
      raw.cognitiveStyle = { archetype: "emotional", thinkingPattern: "" };
    }
  }

  const parsed = brainSchema.parse(brain);

  // Normalize pillar weights
  parsed.contentBias.pillars = normalizePillars(parsed.contentBias.pillars);

  return parsed as CharacterBrain;
}
