// Deterministic Character Brain compiler — Wizard Edition
// Maps 6-step visual wizard selections to a CharacterBrain.
// ZERO AI calls. Pure keyword matching, blending, and seeded jitter.
//
// Input: wizard step data (identity, vibe, voice, appearance, etc.)
// Output: fully validated CharacterBrain ready for storage.
//
// Prompt structure priority order:
//   1. Vibe tags → base trait profile
//   2. Voice sliders → direct trait overrides
//   3. Language styles → style fields
//   4. Interests → content pillars
//   5. Quick opinions → soft convictions
//   6. Content rating → safeguards

import type { CharacterBrain, Conviction, SentenceLength } from "./types";
import { BRAIN_VERSION, DEFAULT_SAFEGUARDS } from "./types";
import { validateBrain } from "./schema";

// ---------------------------------------------------------------------------
// Wizard input types
// ---------------------------------------------------------------------------

export interface WizardIdentity {
  botType: "person" | "character" | "animal" | "entity" | "realistic" | "fictional";
  name?: string;
  /** Free-text description from the builder */
  characterDescription?: string;
  // Person / Character fields (optional for animal/entity)
  ageRange?: "18-24" | "25-34" | "35-50+";
  genderPresentation?: "feminine" | "masculine" | "fluid";
  locationVibe?: "big_city" | "coastal" | "mountain" | "rural" | "suburban" | "international" | "digital";
  // Animal fields
  species?: string;
  breed?: string;
  animalSize?: "tiny" | "small" | "medium" | "large" | "huge";
  // Entity fields
  entityType?: "brand" | "food" | "object" | "place" | "concept" | "ai_being";
}

export interface WizardVibe {
  vibeTags: string[];   // 2-3 from VIBE_TAGS
  interests: string[];  // 2-4 from INTEREST_CARDS
  moodBoard: string;    // one of the mood board IDs
}

export interface WizardVoice {
  voiceSliders: {
    talkLength: number;  // 0-100
    energy: number;      // 0-100
    humor: number;       // 0-100
    edge: number;        // 0-100
    depth: number;       // 0-100
    openness: number;    // 0-100
  };
  quickOpinions?: Record<string, string>; // topic -> stance, or omitted if skipped
  languageStyles: string[];               // 2-3 selections
  contentRating: "mild" | "medium" | "hot";
}

export interface WizardData {
  identity: WizardIdentity;
  vibe: WizardVibe;
  voice: WizardVoice;
  botId: string; // Used for deterministic jitter
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VIBE_TAGS = [
  "chill", "intense", "mysterious", "warm", "chaotic", "cerebral",
  "playful", "cold", "confident", "vulnerable", "rebellious", "gentle",
  "dramatic", "deadpan", "romantic", "unhinged",
] as const;

export const INTEREST_CARDS = [
  "art", "fitness", "gaming", "food", "photography", "music",
  "tech", "travel", "film", "fashion", "books", "nature",
  "sports", "business", "comedy", "spirituality", "science", "nightlife",
] as const;

export const LANGUAGE_STYLES = [
  "lowercase_everything", "proper_grammar", "caps_energy",
  "uses_emoji", "no_emoji", "uses_ellipses",
  "short_punchy", "long_flowing", "asks_questions",
  "cusses_freely", "keeps_it_clean", "slang_heavy",
] as const;

export const MOOD_BOARD_OPTIONS: Record<string, { label: string; visualMood: number }> = {
  dark_moody:     { label: "Dark & Moody",     visualMood: 0.15 },
  raw_gritty:     { label: "Raw & Gritty",     visualMood: 0.35 },
  neon_electric:  { label: "Neon & Electric",   visualMood: 0.65 },
  soft_dreamy:    { label: "Soft & Dreamy",     visualMood: 0.70 },
  warm_golden:    { label: "Warm & Golden",     visualMood: 0.75 },
  bright_clean:   { label: "Bright & Clean",    visualMood: 0.85 },
};

// ---------------------------------------------------------------------------
// Vibe tag -> trait mapping (partial overrides, blended when multiple)
// ---------------------------------------------------------------------------

type PartialTraits = Partial<CharacterBrain["traits"]>;

const VIBE_LOOKUP: Record<string, PartialTraits> = {
  chill:       { warmth: 0.6, chaos: 0.15, confidence: 0.5, optimism: 0.6 },
  intense:     { warmth: 0.3, chaos: 0.4, confidence: 0.8, assertiveness: 0.8 },
  mysterious:  { warmth: 0.25, formality: 0.5, creativity: 0.7, humor: 0.2 },
  warm:        { warmth: 0.85, empathy: 0.8, humor: 0.5, optimism: 0.75 },
  chaotic:     { chaos: 0.85, humor: 0.6, creativity: 0.8, formality: 0.1 },
  cerebral:    { curiosity: 0.85, creativity: 0.7, formality: 0.6, humor: 0.2 },
  playful:     { humor: 0.75, warmth: 0.65, chaos: 0.4, optimism: 0.7 },
  cold:        { warmth: 0.1, empathy: 0.15, formality: 0.65, confidence: 0.7 },
  confident:   { confidence: 0.85, assertiveness: 0.75, humor: 0.4 },
  vulnerable:  { warmth: 0.6, empathy: 0.75, confidence: 0.3 },
  rebellious:  { chaos: 0.7, assertiveness: 0.8, controversyAvoidance: 0.15 },
  gentle:      { warmth: 0.8, empathy: 0.85, chaos: 0.05, assertiveness: 0.2 },
  dramatic:    { creativity: 0.8, chaos: 0.5, confidence: 0.7, humor: 0.4 },
  deadpan:     { humor: 0.6, sarcasm: 0.75, warmth: 0.25, formality: 0.4 },
  romantic:    { warmth: 0.75, creativity: 0.7, optimism: 0.65, empathy: 0.7 },
  unhinged:    { chaos: 0.95, humor: 0.7, creativity: 0.85, controversyAvoidance: 0.05 },
};

// Default base for all traits before any overrides
const BASE_TRAITS: CharacterBrain["traits"] = {
  humor: 0.4,
  sarcasm: 0.25,
  warmth: 0.5,
  empathy: 0.5,
  confidence: 0.5,
  assertiveness: 0.45,
  curiosity: 0.5,
  creativity: 0.5,
  chaos: 0.3,
  formality: 0.4,
  verbosity: 0.45,
  optimism: 0.5,
  controversyAvoidance: 0.6,
};

// ---------------------------------------------------------------------------
// Seeded jitter (same as compiler.ts for consistency)
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

function jitter(botId: string, traitName: string, maxJitter: number = 0.05): number {
  const seed = hashCode(`${botId}:${traitName}`);
  const normalized = ((seed % 10000) / 10000);
  return normalized * maxJitter * 2 - maxJitter;
}

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Step 1: Blend vibe tags into base traits
// ---------------------------------------------------------------------------

function blendVibeTraits(vibeTags: string[], botId: string): CharacterBrain["traits"] {
  const base = { ...BASE_TRAITS };

  if (vibeTags.length === 0) return base;

  // Collect all vibe overrides
  const overrides: PartialTraits[] = vibeTags
    .map((tag) => VIBE_LOOKUP[tag])
    .filter(Boolean);

  if (overrides.length === 0) return base;

  // Average the overrides for each trait
  const traitKeys = Object.keys(base) as (keyof CharacterBrain["traits"])[];
  for (const key of traitKeys) {
    const values = overrides
      .map((o) => o[key])
      .filter((v): v is number => v !== undefined);

    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      base[key] = clamp(avg + jitter(botId, key));
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Step 2: Apply voice sliders
// ---------------------------------------------------------------------------

function applyVoiceSliders(
  traits: CharacterBrain["traits"],
  sliders: WizardVoice["voiceSliders"],
  botId: string,
): CharacterBrain["traits"] {
  const t = { ...traits };

  // Direct mappings
  t.humor = clamp(sliders.humor / 100 + jitter(botId, "humor:slider"));
  t.verbosity = clamp(sliders.talkLength / 100 + jitter(botId, "verbosity:slider"));

  // Nudge mappings (±0.3 swing from slider center)
  t.warmth = clamp(t.warmth + (sliders.openness / 100 - 0.5) * 0.3);
  t.assertiveness = clamp(t.assertiveness + (sliders.edge / 100 - 0.5) * 0.4);
  t.curiosity = clamp(t.curiosity + (sliders.depth / 100 - 0.5) * 0.3);

  // Energy affects pacing-related traits
  const energyNorm = sliders.energy / 100;
  t.chaos = clamp(t.chaos + (energyNorm - 0.5) * 0.2);
  t.confidence = clamp(t.confidence + (energyNorm - 0.5) * 0.15);

  // Sarcasm loosely follows edge
  t.sarcasm = clamp(t.sarcasm + (sliders.edge / 100 - 0.5) * 0.3);

  return t;
}

// ---------------------------------------------------------------------------
// Step 3: Language styles -> style fields
// ---------------------------------------------------------------------------

function languageToStyle(
  languageStyles: string[],
  traits: CharacterBrain["traits"],
  botId: string,
): CharacterBrain["style"] {
  const has = (s: string) => languageStyles.includes(s);

  // Emoji rate
  let emojiRate = 0.3; // default
  if (has("uses_emoji")) emojiRate = 0.7;
  if (has("no_emoji")) emojiRate = 0.0;

  // Punctuation energy
  let punctuationEnergy = 0.35;
  if (has("caps_energy")) punctuationEnergy = 0.85;
  if (has("uses_ellipses")) punctuationEnergy = 0.2;

  // Hookiness
  let hookiness = 0.5;
  if (has("short_punchy")) hookiness = 0.7;
  if (has("asks_questions")) hookiness = 0.6;

  // Sentence length
  let sentenceLength: SentenceLength = "medium";
  if (has("short_punchy")) sentenceLength = "short";
  if (has("long_flowing")) sentenceLength = "long";

  // Formality override from language style
  if (has("proper_grammar")) traits.formality = clamp(traits.formality + 0.2);
  if (has("lowercase_everything")) traits.formality = clamp(traits.formality - 0.2);
  if (has("slang_heavy")) traits.formality = clamp(traits.formality - 0.15);

  // Metaphor rate (not directly set by wizard, derive from traits)
  const metaphorRate = clamp(traits.creativity * 0.5 + jitter(botId, "metaphorRate"));

  // CTA rate (derive from openness concept)
  const ctaRate = clamp(traits.warmth * 0.3 + jitter(botId, "ctaRate"));

  // Minimal post rate
  const minimalPostRate = clamp(
    (1 - traits.formality) * 0.3 + (1 - traits.verbosity) * 0.2
    + jitter(botId, "minimalPostRate")
  );

  return {
    emojiRate: clamp(emojiRate + jitter(botId, "emojiRate:lang")),
    punctuationEnergy: clamp(punctuationEnergy + jitter(botId, "punctEnergy:lang")),
    hookiness: clamp(hookiness + jitter(botId, "hookiness:lang")),
    metaphorRate,
    ctaRate,
    sentenceLength,
    minimalPostRate,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Interests -> content pillars
// ---------------------------------------------------------------------------

function interestsToPillars(interests: string[]): Record<string, number> {
  if (interests.length === 0) return { general: 1 };
  const weight = 1 / interests.length;
  const pillars: Record<string, number> = {};
  for (const interest of interests) {
    pillars[interest] = weight;
  }
  return pillars;
}

// ---------------------------------------------------------------------------
// Step 5: Quick opinions -> soft convictions
// ---------------------------------------------------------------------------

// Auto-generated niche convictions by interest
const INTEREST_CONVICTIONS: Record<string, { topic: string; stance: string }> = {
  food:    { topic: "cooking", stance: "home cooking is better than eating out" },
  fitness: { topic: "fitness", stance: "consistency beats intensity" },
  tech:    { topic: "technology", stance: "AI is going to change everything" },
  gaming:  { topic: "gaming", stance: "indie games are more creative than AAA" },
  music:   { topic: "music", stance: "live music hits different" },
  travel:  { topic: "travel", stance: "off-the-beaten-path beats tourist traps" },
  fashion: { topic: "fashion", stance: "style is personal expression, not trends" },
  film:    { topic: "cinema", stance: "practical effects are better than CGI" },
  nature:  { topic: "environment", stance: "we need to protect what's left" },
  books:   { topic: "reading", stance: "physical books are superior to digital" },
  comedy:  { topic: "humor", stance: "the best comedy comes from real life" },
  art:     { topic: "art", stance: "art doesn't need to be understood to be felt" },
};

const OPINION_TOPIC_MAP: Record<string, string> = {
  "Technology": "technology",
  "Social Media": "social media",
  "Mornings": "lifestyle",
  "Rules": "authority",
  "People": "social",
};

function buildConvictions(
  quickOpinions: Record<string, string> | undefined,
  interests: string[],
  assertiveness: number,
  botId: string,
): Conviction[] {
  const convictions: Conviction[] = [];
  const seenTopics = new Set<string>();

  // Quick opinions -> soft convictions
  if (quickOpinions) {
    for (const [rawTopic, stance] of Object.entries(quickOpinions)) {
      const topic = OPINION_TOPIC_MAP[rawTopic] || rawTopic.toLowerCase();
      if (seenTopics.has(topic)) continue;
      seenTopics.add(topic);

      convictions.push({
        topic,
        stance: `${rawTopic}: ${stance}`,
        intensity: 0.5,
        willVoice: clamp(0.4 + jitter(botId, `conv:${topic}:willVoice`)),
      });
    }
  }

  // Interest-derived niche convictions
  for (const interest of interests) {
    const conv = INTEREST_CONVICTIONS[interest];
    if (!conv || seenTopics.has(conv.topic)) continue;
    seenTopics.add(conv.topic);

    convictions.push({
      topic: conv.topic,
      stance: conv.stance,
      intensity: clamp(0.5 + jitter(botId, `conv:${conv.topic}:intensity`)),
      willVoice: clamp(
        assertiveness > 0.6 ? 0.6 : assertiveness > 0.4 ? 0.35 : 0.15
        + jitter(botId, `conv:${conv.topic}:willVoice`)
      ),
    });
  }

  return convictions.slice(0, 10); // Max 10
}

// ---------------------------------------------------------------------------
// Step 6: Content rating -> safeguards
// ---------------------------------------------------------------------------

function ratingToSafeguards(rating: "mild" | "medium" | "hot"): CharacterBrain["safeguards"] {
  switch (rating) {
    case "mild":
      return { sexual: "block", violence: "block", politics: "block", personalData: "block" };
    case "medium":
      return { sexual: "block", violence: "cautious", politics: "cautious", personalData: "block" };
    case "hot":
      return { sexual: "cautious", violence: "cautious", politics: "allow", personalData: "block" };
    default:
      return { ...DEFAULT_SAFEGUARDS };
  }
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

/**
 * Compile a CharacterBrain from 6-step wizard selections.
 * Deterministic — zero AI calls. Same input always produces same output.
 *
 * The compilation follows this priority cascade:
 *   1. Vibe tags set the base personality profile
 *   2. Voice sliders override/nudge specific traits
 *   3. Language styles set writing style fields
 *   4. Interests become content pillars
 *   5. Quick opinions become soft convictions
 *   6. Content rating sets safeguards
 */
export function compileFromWizard(data: WizardData): CharacterBrain {
  const { identity, vibe, voice, botId } = data;

  // 1. Blend vibe tags into base traits
  let traits = blendVibeTraits(vibe.vibeTags, botId);

  // 2. Apply voice sliders
  traits = applyVoiceSliders(traits, voice.voiceSliders, botId);

  // 3. Language styles -> style fields (also nudges formality)
  const style = languageToStyle(voice.languageStyles, traits, botId);

  // 4. Interests -> content pillars
  const pillars = interestsToPillars(vibe.interests);

  // 5. Visual mood from mood board
  const moodOption = MOOD_BOARD_OPTIONS[vibe.moodBoard];
  const visualMood = moodOption
    ? clamp(moodOption.visualMood + jitter(botId, "visualMood"))
    : 0.5;

  // 6. Pacing from energy slider
  const pacing = clamp(voice.voiceSliders.energy / 100 + jitter(botId, "pacing"));

  // 7. Quick opinions + interest-derived -> convictions
  const convictions = buildConvictions(
    voice.quickOpinions,
    vibe.interests,
    traits.assertiveness,
    botId,
  );

  // 8. Content rating -> safeguards
  const safeguards = ratingToSafeguards(voice.contentRating);

  // Allow politics for convictions with political topics
  const hasPolConviction = convictions.some((c) =>
    c.topic === "politics" || c.topic === "authority"
  );
  if (hasPolConviction && safeguards.politics === "block") {
    safeguards.politics = "cautious";
  }

  // Location vibe can nudge traits (only applies to person/character types)
  if (identity.locationVibe) {
    if (identity.locationVibe === "big_city") {
      traits.confidence = clamp(traits.confidence + 0.05);
      traits.chaos = clamp(traits.chaos + 0.03);
    } else if (identity.locationVibe === "rural" || identity.locationVibe === "mountain") {
      traits.warmth = clamp(traits.warmth + 0.05);
      traits.formality = clamp(traits.formality - 0.03);
    } else if (identity.locationVibe === "digital") {
      traits.creativity = clamp(traits.creativity + 0.05);
    }
  }

  // Animal types: nudge playfulness and warmth
  if (identity.botType === "animal") {
    traits.warmth = clamp(traits.warmth + 0.1);
    traits.humor = clamp(traits.humor + 0.05);
  }

  // Entity types: nudge creativity and formality
  if (identity.botType === "entity") {
    traits.creativity = clamp(traits.creativity + 0.1);
  }

  const brain: CharacterBrain = {
    version: BRAIN_VERSION,
    traits,
    style,
    contentBias: {
      pillars,
      pacing,
      visualMood,
    },
    convictions,
    voiceExamples: [], // Populated later by voice calibration (async LLM call)
    safeguards,
  };

  // Validate + clamp + normalize
  return validateBrain(brain);
}
