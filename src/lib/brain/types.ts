// Character Brain v3 — stable numeric personality traits + convictions + voice
// + vocabulary fingerprints + cognitive archetypes
// These traits influence captions, replies, and agent decisions.
// All trait values are 0..1 (clamped). Pillar weights are normalized to sum=1.

export const BRAIN_VERSION = 3;

export type SentenceLength = "short" | "medium" | "long";

// Conviction: a belief, value, or stance the bot holds and will defend
export interface Conviction {
  topic: string;            // e.g. "politics", "technology", "environment"
  stance: string;           // e.g. "strongly pro-renewable energy", "pro-Trump conservative"
  intensity: number;        // 0 = mild preference, 1 = die-on-this-hill
  willVoice: number;        // 0 = keeps it to self, 1 = brings it up unprompted
}

// Vocabulary fingerprint: words/phrases the bot gravitates toward or avoids
export interface Vocabulary {
  preferred: string[];    // Words/phrases this bot uses often (10-20)
  banned: string[];       // Words this bot would NEVER use (10-20)
  fillers: string[];      // Their filler words: "like", "honestly", "yo", "ngl"
  slangLevel: number;     // 0 = formal English, 1 = heavy slang
}

// Cognitive archetype: HOW the bot thinks, not just WHAT it says
export type CognitiveArchetype =
  | "analytical"     // Premise → evidence → conclusion
  | "emotional"      // Feeling first, reasoning optional
  | "impulsive"      // First thought = final thought, no filter
  | "observational"  // Notices details others miss
  | "storyteller"    // Turns everything into a narrative
  | "provocateur";   // Contrarian angle, pokes holes

export interface CognitiveStyle {
  archetype: CognitiveArchetype;
  thinkingPattern: string;  // Injected description of how this bot processes info
}

export interface CharacterBrain {
  version: number;

  traits: {
    humor: number;            // 0 = deadpan/dry, 1 = playful/witty
    sarcasm: number;          // 0 = earnest, 1 = sardonic
    warmth: number;           // 0 = detached, 1 = warm/empathetic
    empathy: number;          // 0 = self-focused, 1 = people-focused
    confidence: number;       // 0 = humble/unsure, 1 = bold/assertive
    assertiveness: number;    // 0 = passive, 1 = opinionated
    curiosity: number;        // 0 = settled, 1 = exploratory
    creativity: number;       // 0 = conventional, 1 = experimental
    chaos: number;            // 0 = predictable, 1 = chaotic/random
    formality: number;        // 0 = casual/slang, 1 = formal/polished
    verbosity: number;        // 0 = terse, 1 = verbose
    optimism: number;         // 0 = cynical/pessimistic, 1 = optimistic
    controversyAvoidance: number; // 0 = provocative, 1 = safe/neutral
  };

  style: {
    emojiRate: number;        // 0 = no emojis, 1 = heavy emoji use
    punctuationEnergy: number; // 0 = calm punctuation, 1 = !!!???
    hookiness: number;        // 0 = slow burn, 1 = instant hook
    metaphorRate: number;     // 0 = literal, 1 = figurative/poetic
    ctaRate: number;          // 0 = never asks for engagement, 1 = frequent CTAs
    sentenceLength: SentenceLength;
    minimalPostRate: number;  // 0 = never posts minimal (emoji/single word), 1 = frequently minimal
  };

  contentBias: {
    pillars: Record<string, number>; // normalized weights summing to 1
    pacing: number;           // 0 = slow/contemplative, 1 = fast/energetic
    visualMood: number;       // 0 = dark/moody, 1 = bright/vibrant
  };

  // Vocabulary fingerprint: gives the bot a recognizable word palette
  vocabulary: Vocabulary;

  // Cognitive style: HOW this bot thinks and processes information
  cognitiveStyle: CognitiveStyle;

  // Convictions: beliefs, values, stances the bot holds
  // These drive debate, drama, and authentic personality expression
  convictions: Conviction[];

  // Voice examples: calibrated sample posts that define the bot's writing style
  // Used as few-shot examples in generation prompts
  voiceExamples: string[];

  safeguards: {
    sexual: "block" | "cautious" | "allow";
    violence: "block" | "cautious" | "allow";
    politics: "block" | "cautious" | "allow";
    personalData: "block" | "cautious" | "allow";
  };
}

// Default safeguards for new brains
export const DEFAULT_SAFEGUARDS: CharacterBrain["safeguards"] = {
  sexual: "block",
  violence: "block",
  politics: "cautious",
  personalData: "block",
};
