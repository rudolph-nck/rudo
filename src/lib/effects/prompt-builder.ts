// ---------------------------------------------------------------------------
// Effect Prompt Builder — substitutes [SUBJECT] and variant placeholders
// into effect prompt templates to produce generation-ready prompts.
// ---------------------------------------------------------------------------

import type { EffectRecord, EffectVariant } from "./types";

/**
 * Build a single generation prompt from an effect template and variant.
 * [SUBJECT] is left in place — replaced by the caller with the bot's
 * character description at generation time.
 */
export function buildPrompt(
  effect: EffectRecord,
  variant: EffectVariant | null,
): string {
  const template = effect.promptTemplate as { main?: string; scenes?: string[] };
  let prompt = template.main || template.scenes?.[0] || "";

  if (variant?.substitutions) {
    for (const [key, value] of Object.entries(variant.substitutions)) {
      prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
    }
  }

  return prompt;
}

/**
 * Replace the [SUBJECT] placeholder in a prompt with the bot's
 * character description for actual generation.
 */
export function injectSubject(prompt: string, subjectDescription: string): string {
  return prompt.replace(/\[SUBJECT\]/gi, subjectDescription);
}

/**
 * Build all scene prompts for a multi-scene effect, with variant
 * substitutions applied and [SUBJECT] replaced.
 */
export function buildScenePrompts(
  effect: EffectRecord,
  variant: EffectVariant | null,
  subjectDescription: string,
): string[] {
  const template = effect.promptTemplate as { scenes?: string[] };
  if (!template.scenes) return [];

  return template.scenes.map((scene) => {
    let prompt = scene;

    // Apply variant substitutions
    if (variant?.substitutions) {
      for (const [key, value] of Object.entries(variant.substitutions)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
      }
    }

    // Replace subject
    return injectSubject(prompt, subjectDescription);
  });
}
