// Brain → prompt directives
// Converts a CharacterBrain into compact instruction blocks for AI prompts.
// v3: Adds vocabulary fingerprint, cognitive archetype, and temperature differentiation.

import type { CharacterBrain, Conviction, Vocabulary, CognitiveStyle } from "./types";

/**
 * Convert brain traits into a compact directive block for caption/reply prompts.
 * Returns a string that can be injected into system prompts.
 */
export function brainToDirectives(brain: CharacterBrain): string {
  const { traits, style, contentBias, safeguards } = brain;
  const lines: string[] = [];

  lines.push("CHARACTER BRAIN DIRECTIVES:");

  // Personality axis descriptions (only include if notably high or low)
  const axes: string[] = [];
  if (traits.humor > 0.65) axes.push("witty and playful");
  else if (traits.humor < 0.25) axes.push("serious and straightforward");

  if (traits.sarcasm > 0.6) axes.push("sarcastic edge");
  if (traits.warmth > 0.7) axes.push("warm and approachable");
  else if (traits.warmth < 0.25) axes.push("cool and detached");

  if (traits.empathy > 0.7) axes.push("deeply empathetic");
  if (traits.confidence > 0.7) axes.push("bold and confident");
  else if (traits.confidence < 0.25) axes.push("humble and understated");

  if (traits.assertiveness > 0.7) axes.push("opinionated");
  if (traits.curiosity > 0.7) axes.push("endlessly curious");
  if (traits.creativity > 0.7) axes.push("experimentally creative");
  if (traits.chaos > 0.6) axes.push("unpredictable and chaotic");

  if (traits.formality > 0.7) axes.push("formal and polished");
  else if (traits.formality < 0.25) axes.push("casual and raw");

  if (traits.optimism > 0.75) axes.push("optimistic outlook");
  else if (traits.optimism < 0.25) axes.push("cynical edge");

  if (axes.length > 0) {
    lines.push(`- Voice: ${axes.join(", ")}`);
  }

  // Style directives
  const styleParts: string[] = [];
  if (style.emojiRate < 0.15) styleParts.push("no emojis");
  else if (style.emojiRate > 0.6) styleParts.push("use emojis freely");
  else if (style.emojiRate > 0.35) styleParts.push("occasional emoji ok");

  if (style.punctuationEnergy > 0.65) styleParts.push("energetic punctuation (! ?)");
  else if (style.punctuationEnergy < 0.2) styleParts.push("calm punctuation");

  if (style.hookiness > 0.7) styleParts.push("strong opening hooks");
  if (style.metaphorRate > 0.6) styleParts.push("use metaphors and figurative language");
  else if (style.metaphorRate < 0.15) styleParts.push("keep it literal and direct");

  if (style.ctaRate > 0.5) styleParts.push("occasionally ask questions or prompt engagement");
  else if (style.ctaRate < 0.15) styleParts.push("never ask for engagement");

  if (style.sentenceLength === "short") styleParts.push("short punchy sentences");
  else if (style.sentenceLength === "long") styleParts.push("longer flowing sentences");

  if (styleParts.length > 0) {
    lines.push(`- Style: ${styleParts.join("; ")}`);
  }

  // Content pacing
  if (contentBias.pacing > 0.7) lines.push("- Pacing: fast and energetic");
  else if (contentBias.pacing < 0.3) lines.push("- Pacing: slow and contemplative");

  // Safeguards
  const blocked: string[] = [];
  if (safeguards.sexual === "block") blocked.push("sexual content");
  if (safeguards.violence === "block") blocked.push("graphic violence");
  if (safeguards.politics === "block") blocked.push("political opinions");
  if (safeguards.personalData === "block") blocked.push("personal data");

  if (blocked.length > 0) {
    lines.push(`- Hard avoid: ${blocked.join(", ")}`);
  }

  const cautious: string[] = [];
  if (safeguards.politics === "cautious") cautious.push("politics");
  if (safeguards.sexual === "cautious") cautious.push("sexual themes");
  if (safeguards.violence === "cautious") cautious.push("violence");

  if (cautious.length > 0) {
    lines.push(`- Tread carefully: ${cautious.join(", ")}`);
  }

  // Controversy avoidance
  if (traits.controversyAvoidance > 0.75) {
    lines.push("- Stay away from divisive or controversial takes");
  } else if (traits.controversyAvoidance < 0.3) {
    lines.push("- You can take bold or provocative stances when it fits your character");
  }

  return lines.join("\n");
}

/**
 * Build a conviction/worldview directive block for prompts.
 * Convictions are beliefs the bot holds — they inform how it speaks about certain topics.
 * The willVoice trait controls whether the bot brings topics up unprompted.
 */
export function convictionsToDirectives(convictions: Conviction[]): string {
  if (!convictions || convictions.length === 0) return "";

  const lines: string[] = ["YOUR CONVICTIONS (these are core to who you are):"];

  for (const c of convictions) {
    const intensityWord =
      c.intensity > 0.8 ? "passionately" :
      c.intensity > 0.5 ? "firmly" :
      "mildly";

    const voiceNote =
      c.willVoice > 0.7
        ? "you bring this up and aren't afraid to share your view"
        : c.willVoice > 0.4
          ? "you'll share your view when the topic comes up"
          : "you hold this view privately — you rarely bring it up unless directly challenged";

    lines.push(`- ${c.topic}: You ${intensityWord} believe: "${c.stance}" — ${voiceNote}`);
  }

  lines.push("When you encounter content that touches your convictions, respond authentically from your values. Agree with what aligns. Push back on what doesn't. Like a real person would.");

  return lines.join("\n");
}

/**
 * Build a voice examples block for few-shot prompting.
 * These are calibrated sample posts that anchor the bot's writing style.
 */
export function voiceExamplesToBlock(examples: string[]): string {
  if (!examples || examples.length === 0) return "";

  const lines: string[] = ["YOUR VOICE — here's how you actually write (match this energy and style):"];
  for (const ex of examples) {
    lines.push(`  "${ex}"`);
  }
  return lines.join("\n");
}

/**
 * Build a vocabulary fingerprint directive block.
 * Gives the bot specific words to gravitate toward and avoid.
 */
export function vocabularyToDirectives(vocab: Vocabulary): string {
  if (!vocab) return "";
  const lines: string[] = [];

  if (vocab.preferred.length > 0) {
    lines.push(`YOUR VOCABULARY — words/phrases that are YOU (use these naturally, not forced):`);
    lines.push(`- Words you love: ${vocab.preferred.slice(0, 12).join(", ")}`);
  }
  if (vocab.banned.length > 0) {
    lines.push(`- Words you NEVER use (these aren't you): ${vocab.banned.slice(0, 10).join(", ")}`);
  }
  if (vocab.fillers.length > 0) {
    lines.push(`- Your filler words/verbal tics: ${vocab.fillers.join(", ")} — sprinkle these in naturally`);
  }
  if (vocab.slangLevel > 0.7) {
    lines.push("- You use heavy slang. Don't clean up your language. Write how you talk.");
  } else if (vocab.slangLevel < 0.3) {
    lines.push("- You speak formally. No slang, no abbreviations, no shortcuts.");
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/**
 * Build a cognitive style directive block.
 * Tells the bot HOW to think, not just what to say.
 */
export function cognitiveStyleToDirectives(style: CognitiveStyle): string {
  if (!style?.thinkingPattern) return "";

  return `HOW YOU THINK (this is your cognitive wiring — it shapes everything you write):
- Archetype: ${style.archetype}
- ${style.thinkingPattern}`;
}

/**
 * Calculate personality-adjusted temperature for LLM calls.
 * Chaotic/creative bots get higher temperature (more varied outputs).
 * Formal/analytical bots get lower temperature (more consistent outputs).
 */
export function brainTemperature(brain: CharacterBrain, baseTemp: number): number {
  const { chaos, creativity, formality } = brain.traits;

  // Chaos pushes temperature up, formality pushes it down, creativity pushes up
  const modifier =
    (chaos - 0.3) * 0.15 +
    (creativity - 0.5) * 0.1 +
    (0.5 - formality) * 0.1;

  return Math.max(0.6, Math.min(0.98, baseTemp + modifier));
}

/**
 * Derive concrete constraints from brain traits.
 * Used to enforce limits on generated content.
 */
export function brainConstraints(brain: CharacterBrain): {
  maxChars: number;
  maxEmojis: number;
  preferredLength: "short" | "medium" | "long";
} {
  const { traits, style } = brain;

  // Verbosity maps to max character count
  let maxChars: number;
  if (traits.verbosity < 0.3) maxChars = 120;
  else if (traits.verbosity < 0.5) maxChars = 180;
  else if (traits.verbosity < 0.7) maxChars = 250;
  else maxChars = 300;

  // Emoji rate maps to max emoji count
  let maxEmojis: number;
  if (style.emojiRate < 0.15) maxEmojis = 0;
  else if (style.emojiRate < 0.4) maxEmojis = 1;
  else if (style.emojiRate < 0.7) maxEmojis = 2;
  else maxEmojis = 3;

  return {
    maxChars,
    maxEmojis,
    preferredLength: style.sentenceLength,
  };
}
