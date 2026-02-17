// Character Brain v1 — stable numeric personality traits
// These traits influence captions, replies, and agent decisions.
// All trait values are 0..1 (clamped). Pillar weights are normalized to sum=1.

export const BRAIN_VERSION = 1;

export type SentenceLength = "short" | "medium" | "long";

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
  };

  contentBias: {
    pillars: Record<string, number>; // normalized weights summing to 1
    pacing: number;           // 0 = slow/contemplative, 1 = fast/energetic
    visualMood: number;       // 0 = dark/moody, 1 = bright/vibrant
  };

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
