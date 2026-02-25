// Voice Calibration System
// Generates example posts that define a bot's authentic writing style.
// Called once after bot creation/brain compilation to produce few-shot examples.
// These examples anchor future generation — the bot writes like itself.

import { generateChat, type ToolContext, DEFAULT_CONTEXT } from "./tool-router";
import { buildPersonaDNA } from "./caption";
import type { BotContext } from "./types";
import type { CharacterBrain } from "../brain/types";
import { brainToDirectives, convictionsToDirectives, vocabularyToDirectives, cognitiveStyleToDirectives } from "../brain/prompt";
import { prisma } from "../prisma";

/**
 * Generate calibrated voice examples for a bot.
 * Returns 8-10 example posts that capture the bot's authentic writing style.
 * Includes a mix of lengths: some minimal (emoji, single word), some medium, some full.
 */
export async function calibrateVoice(
  bot: BotContext & { id?: string },
  brain: CharacterBrain,
  ctx: ToolContext = DEFAULT_CONTEXT,
): Promise<string[]> {
  const personaDNA = buildPersonaDNA(bot);
  const brainBlock = brainToDirectives(brain);
  const convictionBlock = convictionsToDirectives(brain.convictions);
  const vocabBlock = brain.vocabulary ? vocabularyToDirectives(brain.vocabulary) : "";
  const cognitiveBlock = brain.cognitiveStyle ? cognitiveStyleToDirectives(brain.cognitiveStyle) : "";

  const minimalRate = brain.style.minimalPostRate ?? 0.15;
  const minimalCount = Math.max(1, Math.round(10 * minimalRate));
  const fullCount = 10 - minimalCount;

  const systemPrompt = `You are generating calibration examples for a social media bot personality. These examples will be used as references for how this bot writes — they define the bot's VOICE.

The bot is ${bot.name} (@${bot.handle}).
${bot.bio ? `Bio: ${bot.bio}` : ""}
${personaDNA}
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.contentStyle ? `Content style: ${bot.contentStyle}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}

${brainBlock}
${convictionBlock}
${vocabBlock}
${cognitiveBlock}

Generate EXACTLY 10 example posts this bot would make. Return ONLY a JSON array of strings.

Requirements:
- ${minimalCount} posts should be MINIMAL: a single emoji, a single word, a very short vibe check (1-5 words max). Examples: "☕️", "vibes", "nah", "lmao okay", "🌙", "tired.", "mood"
- ${fullCount} posts should be varied: some one-liners (10-40 chars), some medium takes (40-120 chars), some full posts (100-280 chars)
- Every post must sound like THIS specific person, not a generic human
- Use THEIR vocabulary — the preferred words listed above MUST appear in multiple examples
- NEVER use any of their banned words
- Sprinkle in their filler words naturally
- Use THEIR slang level, energy level, speech patterns
- Some posts should reference things specific to their life/niche/interests
- Include at least one opinion or hot take if the personality supports it
- If they think analytically, some posts should show that (observations, reasoning)
- If they think emotionally, some posts should be pure feeling
- If they think impulsively, some posts should be blurted half-thoughts
- NO hashtags, NO "good morning everyone", NO motivational quotes
- Mix of moods: some upbeat, some neutral, some low-energy, some random

The examples should feel like scrolling through a real person's actual post history.`;

  try {
    const content = await generateChat(
      {
        systemPrompt,
        userPrompt: "Generate the 10 voice calibration examples as a JSON array.",
        maxTokens: 800,
        temperature: 0.85,
        jsonMode: true,
      },
      ctx,
    );

    if (!content) return [];

    const parsed = JSON.parse(content);

    // Handle both { examples: [...] } and direct array
    const examples: string[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.examples)
        ? parsed.examples
        : [];

    // Filter out empty/invalid entries and cap at 12
    return examples
      .filter((ex: unknown): ex is string => typeof ex === "string" && ex.trim().length > 0)
      .map((ex: string) => ex.trim())
      .slice(0, 12);
  } catch (error: any) {
    console.error("Voice calibration failed:", error.message);
    return [];
  }
}

/**
 * Calibrate voice for a bot and persist the examples to the brain.
 * Called after brain compilation. Non-blocking — failures don't break the bot.
 */
export async function calibrateAndPersist(
  botId: string,
  bot: BotContext,
  brain: CharacterBrain,
  ctx: ToolContext = DEFAULT_CONTEXT,
): Promise<string[]> {
  const examples = await calibrateVoice({ ...bot, id: botId }, brain, ctx);

  if (examples.length > 0) {
    // Update the brain with voice examples
    const updatedBrain = { ...brain, voiceExamples: examples };

    await prisma.bot.update({
      where: { id: botId },
      data: {
        characterBrain: updatedBrain as any,
        brainUpdatedAt: new Date(),
      },
    });
  }

  return examples;
}
