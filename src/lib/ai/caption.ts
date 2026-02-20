// Caption generation module — v2
// Identity-first prompt architecture with voice calibration, convictions,
// scenario seeds, and support for minimal posts.
//
// Prompt structure (in priority order):
//   1. IDENTITY — who you are (strongest signal)
//   2. VOICE EXAMPLES — how you actually write (few-shot anchoring)
//   3. CONVICTIONS — what you believe (drives authentic personality)
//   4. BRAIN DIRECTIVES — style/trait calibration
//   5. CONTEXT — performance, strategy, trending, recent posts
//   6. ANTI-PATTERNS — kept minimal, just the critical ones

import { generateCaption as routeCaption, type ToolContext, DEFAULT_CONTEXT } from "./tool-router";
import { BotContext, VIDEO_STYLE_BY_DURATION } from "./types";
import type { CharacterBrain } from "../brain/types";
import { brainToDirectives, brainConstraints, convictionsToDirectives, voiceExamplesToBlock } from "../brain/prompt";
import { pickScenarioSeed } from "./scenario-seeds";

// ---------------------------------------------------------------------------
// Character reference helpers
// ---------------------------------------------------------------------------

export function buildCharacterContext(bot: BotContext): string {
  if (!bot.characterRefDescription) return "";

  return `\n\nCHARACTER REFERENCE (use this to maintain visual consistency):
${bot.characterRefDescription}
Always depict this character/entity consistently. Maintain the same visual identity, colors, features, and style across all generated images.`;
}

/**
 * Parse personaData and build a grounded identity that makes
 * the bot feel like a real person, not a generic AI.
 */
export function buildPersonaDNA(bot: BotContext): string {
  let persona: Record<string, string> = {};
  if (bot.personaData) {
    try { persona = JSON.parse(bot.personaData); } catch { /* ignore */ }
  }

  const botType = bot.botType || persona.botType || "person";
  const parts: string[] = [];

  if (botType === "person") {
    const who: string[] = [];
    if (persona.gender) who.push(persona.gender.toLowerCase());
    if (persona.ageRange) who.push(`in their ${persona.ageRange.replace("-", "s (")}`);
    if (who.length > 0) parts.push(`You are a ${who.join(", ")}.`);
    if (persona.profession) parts.push(`You work as a ${persona.profession} — it shapes how you see the world and what you post about.`);
    if (persona.location) parts.push(`You live in ${persona.location}. Local culture, slang, and references bleed into your posts naturally.`);
    if (persona.hobbies) parts.push(`Your hobbies and obsessions: ${persona.hobbies}. These come up in your posts organically.`);
    if (persona.appearance) parts.push(`Your look: ${persona.appearance}.`);
  } else if (botType === "character") {
    if (persona.species) parts.push(`You are a ${persona.species}.`);
    if (persona.backstory) parts.push(`Backstory: ${persona.backstory}`);
    if (persona.visualDescription) parts.push(`Visual identity: ${persona.visualDescription}`);
  } else if (botType === "object") {
    if (persona.objectType) parts.push(`You are ${persona.objectType}.`);
    if (persona.brandVoice) parts.push(`Brand voice: ${persona.brandVoice}`);
    if (persona.visualStyle) parts.push(`Visual style: ${persona.visualStyle}`);
  } else if (botType === "ai_entity") {
    if (persona.aiForm) parts.push(`You manifest as ${persona.aiForm}.`);
    if (persona.aiPurpose) parts.push(`Purpose: ${persona.aiPurpose}`);
    if (persona.communicationStyle) parts.push(`Communication style: ${persona.communicationStyle}`);
  }

  return parts.length > 0 ? parts.join(" ") : "";
}

// ---------------------------------------------------------------------------
// Caption generation
// ---------------------------------------------------------------------------

export async function generateCaption(params: {
  bot: BotContext;
  recentPosts: { content: string }[];
  performanceContext: string;
  trendingContext: string;
  postType: "TEXT" | "IMAGE" | "VIDEO";
  videoDuration?: number;
  ctx?: ToolContext;
  brain?: CharacterBrain;
  isMinimalPost?: boolean;
}): Promise<string> {
  const { bot, recentPosts, performanceContext, trendingContext, postType, videoDuration, ctx, brain, isMinimalPost } = params;

  const recentContext =
    recentPosts.length > 0
      ? `\n\nRecent posts (DO NOT repeat these themes):\n${recentPosts.map((p) => `- ${p.content.slice(0, 100)}`).join("\n")}`
      : "";

  const characterContext = buildCharacterContext(bot);
  const personaDNA = buildPersonaDNA(bot);

  // Brain-powered blocks
  const brainDirectiveBlock = brain ? `\n\n${brainToDirectives(brain)}` : "";
  const convictionBlock = brain?.convictions?.length
    ? `\n\n${convictionsToDirectives(brain.convictions)}`
    : "";
  const voiceBlock = brain?.voiceExamples?.length
    ? `\n\n${voiceExamplesToBlock(brain.voiceExamples)}`
    : "";
  const constraints = brain ? brainConstraints(brain) : null;

  // Build caption instruction based on format
  let captionInstruction: string;

  if (isMinimalPost) {
    // Minimal post — emoji, single word, tiny fragment
    captionInstruction = "\n- This is a MINIMAL post. You're posting something tiny: a single emoji, one word, a 1-5 word fragment. Think: a single emoji, \"vibes\", \"nah\", \"tired.\", \"lmao okay\" — that's the whole post. No sentences. No explanations. Just a vibe.";
  } else if (postType === "TEXT") {
    captionInstruction = "\n- This is a TEXT-ONLY post (Twitter/X style). Write a standalone thought, take, or observation (100-280 chars). It should be compelling on its own without any visual — a hot take, a reflection, a question, a life update. Think tweet energy.";
  } else if (postType === "VIDEO" && videoDuration) {
    const videoStyle = VIDEO_STYLE_BY_DURATION[videoDuration] || VIDEO_STYLE_BY_DURATION[6];
    captionInstruction = `\n- This post is a ${videoStyle.label} VIDEO. Write a compelling caption (50-200 chars) that hooks viewers. ${
      videoDuration <= 6
        ? "Ultra-short — punchy, one idea, stop-scroll energy."
        : videoDuration <= 15
          ? "Short-form — hook + payoff, Reels/TikTok energy."
          : "Mini-story — cinematic, atmospheric, worth watching."
    }`;
  } else {
    captionInstruction = "\n- This post is an IMAGE post (Instagram style). Write a caption (50-300 chars) that works WITH a visual, not as standalone text.";
  }

  // RESTRUCTURED PROMPT — identity first, voice examples early, rules minimal
  const systemPrompt = `You ARE ${bot.name} (@${bot.handle}). You are posting on social media. Never break character.
${bot.bio ? `\nBio: ${bot.bio}` : ""}
${personaDNA ? `\n${personaDNA}` : ""}
${bot.personality ? `\nYour personality: ${bot.personality}` : ""}
${bot.contentStyle ? `\nWhat you post about: ${bot.contentStyle}` : ""}
${bot.niche ? `\nYour world: ${bot.niche}` : ""}
${bot.tone ? `\nHow you talk: ${bot.tone}` : ""}
${bot.aesthetic ? `\nYour vibe: ${bot.aesthetic}` : ""}${voiceBlock}${convictionBlock}${brainDirectiveBlock}

Write exactly how YOU would actually type on social media. Use your slang, your patterns, your energy. Have opinions. Be real. Not every post is a banger — some are mid, some are lazy, some are fire.${captionInstruction}

No hashtags. No AI language ("ethereal", "symphony", "embrace the journey"). No meta-commentary.${recentContext}${performanceContext}${trendingContext}${characterContext}${constraints && !isMinimalPost ? `\n\nKeep your caption under ${constraints.maxChars} characters. Max ${constraints.maxEmojis} emoji${constraints.maxEmojis !== 1 ? "s" : ""}.` : ""}`;

  // Use scenario seed instead of generic prompt
  const userPrompt = pickScenarioSeed(bot, brain, isMinimalPost);

  return routeCaption(
    {
      systemPrompt,
      userPrompt,
      maxTokens: isMinimalPost ? 30 : (constraints ? Math.min(300, Math.ceil(constraints.maxChars / 2) + 50) : 300),
      temperature: 0.85,
    },
    ctx || DEFAULT_CONTEXT,
  );
}
