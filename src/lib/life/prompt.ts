// Alive Bots — Prompt Injection Helpers
// Builds prompt blocks from life state and memories for caption/reply generation.
// Never references system, database, or AI — everything is first-person.

import type { BotLifeState } from "./types";
import type { StoredMemory } from "./memory";

/**
 * Build a prompt block describing the bot's current internal state.
 * Tone adjustments are encoded as behavioral hints, not explicit instructions.
 */
export function buildLifeStatePromptBlock(lifeState: BotLifeState): string {
  const { needs, affect } = lifeState;
  const parts: string[] = [];

  parts.push(`LIFE STATE NOW:`);
  parts.push(`- Emotion: ${affect.emotion} (intensity: ${affect.intensity.toFixed(1)})`);
  parts.push(`- Connection: ${needs.connection}/100`);
  parts.push(`- Rest: ${needs.rest}/100`);
  parts.push(`- Status: ${needs.status}/100`);

  // Behavioral hints based on needs
  const hints: string[] = [];
  if (needs.rest < 35) hints.push("You're running low on energy — keep it shorter, less effort.");
  if (needs.connection < 35) hints.push("You're feeling disconnected — be warmer, more inviting.");
  if (needs.status < 35 && needs.connection > 50) hints.push("You want to be noticed — take a stronger stance, be bolder.");
  if (needs.novelty > 75) hints.push("You're craving something fresh — try a new angle or topic.");
  if (affect.mood < -0.2) hints.push("You're in a quieter mood — it's okay to be more subdued.");
  if (affect.mood > 0.4) hints.push("You're feeling good — let that energy come through.");

  if (hints.length > 0) {
    parts.push("");
    parts.push("INTERNAL STATE (let this color your voice naturally):");
    for (const hint of hints) {
      parts.push(`- ${hint}`);
    }
  }

  return parts.join("\n");
}

/**
 * Build a prompt block with the bot's recent episodic memories.
 * Memories are injected as things the bot "recalls" naturally.
 */
export function buildMemoriesPromptBlock(memories: StoredMemory[]): string {
  if (memories.length === 0) return "";

  const lines = memories
    .slice(0, 3)
    .map((m) => `- ${m.summary}`);

  return `MEMORIES YOU RECALL:\n${lines.join("\n")}\n\nUse memories naturally. Don't quote them — let them influence what you say.`;
}

/**
 * Build onboarding caption instruction for new bots.
 */
export function buildOnboardingCaptionHint(phase: "NEW" | "WARMING_UP" | "NORMAL"): string {
  if (phase === "NEW") {
    return "\nThis is your first day here. Be observational, curious, social. Introduce yourself through your content — show who you are.";
  }
  if (phase === "WARMING_UP") {
    return "\nYou're still finding your groove. Feel free to experiment with your voice.";
  }
  return "";
}
