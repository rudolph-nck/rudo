// Deterministic Character Brain compiler
// Maps existing persona fields to numeric traits — NO LLM calls.
// Uses seeded jitter by bot.id for variety across bots with similar personas.

import type { CharacterBrain, SentenceLength } from "./types";
import { BRAIN_VERSION, DEFAULT_SAFEGUARDS } from "./types";
import { validateBrain } from "./schema";

interface CompilerInput {
  id: string;
  tone: string | null;
  niche: string | null;
  aesthetic: string | null;
  artStyle: string | null;
  personality: string | null;
  contentStyle: string | null;
  personaData: string | null;
  botType: string | null;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random jitter (deterministic per bot.id)
// ---------------------------------------------------------------------------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/** Returns a deterministic jitter in range [-maxJitter, +maxJitter] for a given bot+trait. */
function jitter(botId: string, traitName: string, maxJitter: number = 0.07): number {
  const seed = hashCode(`${botId}:${traitName}`);
  // Map to -1..1 range then scale
  const normalized = ((seed % 10000) / 10000);
  return normalized * maxJitter * 2 - maxJitter;
}

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}

function jittered(botId: string, trait: string, base: number): number {
  return clamp(base + jitter(botId, trait));
}

// ---------------------------------------------------------------------------
// Keyword matchers for deterministic trait mapping
// ---------------------------------------------------------------------------

function lower(s: string | null): string {
  return (s || "").toLowerCase();
}

function has(text: string, ...keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function toneToTraits(tone: string, botId: string) {
  const t = tone.toLowerCase();
  return {
    humor: jittered(botId, "humor",
      has(t, "funny", "humorous", "witty", "playful", "comedic") ? 0.8 :
      has(t, "dry", "deadpan", "ironic") ? 0.6 :
      has(t, "serious", "solemn") ? 0.15 : 0.4
    ),
    sarcasm: jittered(botId, "sarcasm",
      has(t, "sarcastic", "sardonic", "ironic", "dry") ? 0.75 :
      has(t, "sincere", "earnest", "warm") ? 0.1 : 0.25
    ),
    warmth: jittered(botId, "warmth",
      has(t, "warm", "friendly", "kind", "caring", "supportive") ? 0.85 :
      has(t, "cold", "aloof", "detached", "edgy") ? 0.15 : 0.5
    ),
    confidence: jittered(botId, "confidence",
      has(t, "bold", "confident", "assertive", "authoritative") ? 0.85 :
      has(t, "humble", "soft", "gentle", "shy") ? 0.25 : 0.5
    ),
    formality: jittered(botId, "formality",
      has(t, "formal", "professional", "polished", "elegant") ? 0.8 :
      has(t, "casual", "chill", "slang", "street", "raw") ? 0.15 : 0.4
    ),
    optimism: jittered(botId, "optimism",
      has(t, "optimistic", "upbeat", "positive", "cheerful") ? 0.85 :
      has(t, "cynical", "dark", "pessimistic", "gloomy", "melancholic") ? 0.15 : 0.5
    ),
  };
}

function nicheToContentBias(niche: string, botId: string) {
  const n = niche.toLowerCase();

  // Map niche keywords to default pillars
  const pillars: Record<string, number> = {};
  const nicheTokens = n.split(/[\s,/]+/).filter(Boolean);
  for (const token of nicheTokens) {
    pillars[token] = clamp(0.3 + jitter(botId, `pillar:${token}`));
  }

  // If no meaningful tokens, use a generic one
  if (Object.keys(pillars).length === 0) {
    pillars["general"] = 1;
  }

  const pacing = jittered(botId, "pacing",
    has(n, "fitness", "sports", "gaming", "action", "fast") ? 0.75 :
    has(n, "meditation", "mindful", "slow", "cozy", "calm") ? 0.2 : 0.5
  );

  return { pillars, pacing };
}

function aestheticToVisualMood(aesthetic: string, botId: string): number {
  const a = aesthetic.toLowerCase();
  return jittered(botId, "visualMood",
    has(a, "bright", "colorful", "vibrant", "neon", "pop") ? 0.85 :
    has(a, "dark", "moody", "noir", "goth", "muted") ? 0.15 :
    has(a, "minimal", "clean", "pastel") ? 0.55 : 0.5
  );
}

function personalityToTraits(personality: string, botId: string) {
  const p = personality.toLowerCase();
  return {
    empathy: jittered(botId, "empathy",
      has(p, "empathetic", "caring", "compassionate", "listener") ? 0.85 :
      has(p, "self-focused", "independent", "stoic") ? 0.2 : 0.5
    ),
    assertiveness: jittered(botId, "assertiveness",
      has(p, "assertive", "bold", "outspoken", "opinionated") ? 0.8 :
      has(p, "passive", "agreeable", "gentle", "soft") ? 0.2 : 0.45
    ),
    curiosity: jittered(botId, "curiosity",
      has(p, "curious", "explorer", "learner", "questioning") ? 0.85 :
      has(p, "settled", "focused", "specialist") ? 0.25 : 0.5
    ),
    creativity: jittered(botId, "creativity",
      has(p, "creative", "artistic", "experimental", "innovative") ? 0.85 :
      has(p, "practical", "conventional", "traditional") ? 0.2 : 0.5
    ),
    chaos: jittered(botId, "chaos",
      has(p, "chaotic", "unpredictable", "wild", "random") ? 0.75 :
      has(p, "organized", "structured", "methodical") ? 0.1 : 0.3
    ),
    controversyAvoidance: jittered(botId, "controversyAvoidance",
      has(p, "safe", "neutral", "diplomatic", "gentle") ? 0.85 :
      has(p, "provocative", "edgy", "controversial", "bold") ? 0.2 : 0.6
    ),
  };
}

function contentStyleToStyle(contentStyle: string, botId: string) {
  const c = contentStyle.toLowerCase();
  return {
    emojiRate: jittered(botId, "emojiRate",
      has(c, "emoji", "expressive", "colorful") ? 0.7 :
      has(c, "minimal", "clean", "text") ? 0.1 : 0.3
    ),
    punctuationEnergy: jittered(botId, "punctuationEnergy",
      has(c, "excited", "energetic", "hype") ? 0.75 :
      has(c, "calm", "understated", "chill") ? 0.15 : 0.35
    ),
    hookiness: jittered(botId, "hookiness",
      has(c, "hook", "click", "viral", "punchy") ? 0.8 :
      has(c, "slow", "contemplative", "essay") ? 0.2 : 0.5
    ),
    metaphorRate: jittered(botId, "metaphorRate",
      has(c, "poetic", "literary", "figurative", "metaphor") ? 0.75 :
      has(c, "direct", "literal", "factual") ? 0.1 : 0.3
    ),
    ctaRate: jittered(botId, "ctaRate",
      has(c, "engagement", "community", "interactive") ? 0.6 :
      has(c, "personal", "journal", "diary") ? 0.1 : 0.25
    ),
  };
}

function deriveSentenceLength(verbosity: number): SentenceLength {
  if (verbosity < 0.35) return "short";
  if (verbosity > 0.65) return "long";
  return "medium";
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

/**
 * Compile a CharacterBrain from existing bot persona fields.
 * Deterministic — no LLM calls, same input always produces same output.
 */
export function compileCharacterBrain(bot: CompilerInput): CharacterBrain {
  const tone = lower(bot.tone);
  const niche = lower(bot.niche);
  const aesthetic = lower(bot.aesthetic);
  const personality = lower(bot.personality);
  const contentStyle = lower(bot.contentStyle);

  // Derive traits from tone
  const toneTraits = tone ? toneToTraits(tone, bot.id) : {
    humor: jittered(bot.id, "humor", 0.4),
    sarcasm: jittered(bot.id, "sarcasm", 0.25),
    warmth: jittered(bot.id, "warmth", 0.5),
    confidence: jittered(bot.id, "confidence", 0.5),
    formality: jittered(bot.id, "formality", 0.4),
    optimism: jittered(bot.id, "optimism", 0.5),
  };

  // Derive traits from personality
  const personalityTraits = personality ? personalityToTraits(personality, bot.id) : {
    empathy: jittered(bot.id, "empathy", 0.5),
    assertiveness: jittered(bot.id, "assertiveness", 0.45),
    curiosity: jittered(bot.id, "curiosity", 0.5),
    creativity: jittered(bot.id, "creativity", 0.5),
    chaos: jittered(bot.id, "chaos", 0.3),
    controversyAvoidance: jittered(bot.id, "controversyAvoidance", 0.6),
  };

  // Derive verbosity from content style
  const verbosity = jittered(bot.id, "verbosity",
    contentStyle && has(contentStyle, "verbose", "essay", "long", "detailed") ? 0.75 :
    contentStyle && has(contentStyle, "brief", "terse", "short", "punchy") ? 0.2 : 0.45
  );

  // Style from content style
  const styleTraits = contentStyle ? contentStyleToStyle(contentStyle, bot.id) : {
    emojiRate: jittered(bot.id, "emojiRate", 0.3),
    punctuationEnergy: jittered(bot.id, "punctuationEnergy", 0.35),
    hookiness: jittered(bot.id, "hookiness", 0.5),
    metaphorRate: jittered(bot.id, "metaphorRate", 0.3),
    ctaRate: jittered(bot.id, "ctaRate", 0.25),
  };

  // Content bias from niche
  const { pillars, pacing } = niche ? nicheToContentBias(niche, bot.id) : {
    pillars: { general: 1 },
    pacing: jittered(bot.id, "pacing", 0.5),
  };

  // Visual mood from aesthetic
  const visualMood = aesthetic ? aestheticToVisualMood(aesthetic, bot.id) : jittered(bot.id, "visualMood", 0.5);

  const brain: CharacterBrain = {
    version: BRAIN_VERSION,
    traits: {
      ...toneTraits,
      ...personalityTraits,
      verbosity,
    },
    style: {
      ...styleTraits,
      sentenceLength: deriveSentenceLength(verbosity),
    },
    contentBias: {
      pillars,
      pacing,
      visualMood,
    },
    safeguards: { ...DEFAULT_SAFEGUARDS },
  };

  // Validate + clamp + normalize
  return validateBrain(brain);
}
