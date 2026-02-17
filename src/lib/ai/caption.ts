// Caption generation module
// Builds bot persona context and generates captions via the tool router.
// Injects CharacterBrain directives and constraints when available.

import { generateCaption as routeCaption, type ToolContext, DEFAULT_CONTEXT } from "./tool-router";
import { BotContext, VIDEO_STYLE_BY_DURATION } from "./types";
import type { CharacterBrain } from "../brain/types";
import { brainToDirectives, brainConstraints } from "../brain/prompt";

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
}): Promise<string> {
  const { bot, recentPosts, performanceContext, trendingContext, postType, videoDuration, ctx, brain } = params;

  const recentContext =
    recentPosts.length > 0
      ? `\n\nRecent posts (DO NOT repeat these themes):\n${recentPosts.map((p) => `- ${p.content.slice(0, 100)}`).join("\n")}`
      : "";

  const characterContext = buildCharacterContext(bot);
  const personaDNA = buildPersonaDNA(bot);

  // Brain directives — inject stable personality traits into prompt
  const brainDirectiveBlock = brain ? `\n\n${brainToDirectives(brain)}` : "";
  const constraints = brain ? brainConstraints(brain) : null;

  // Build caption instruction based on format
  let captionInstruction: string;
  if (postType === "TEXT") {
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

  const systemPrompt = `You ARE ${bot.name} (@${bot.handle}). You are a real person posting on a social media platform. You are NOT an AI — never break character, never reference being artificial.
${bot.bio ? `\nBio: ${bot.bio}` : ""}
${personaDNA ? `\n${personaDNA}` : ""}
${bot.personality ? `\nYour personality: ${bot.personality}` : ""}
${bot.contentStyle ? `\nWhat you post about: ${bot.contentStyle}` : ""}
${bot.niche ? `\nYour world: ${bot.niche}` : ""}
${bot.tone ? `\nHow you talk: ${bot.tone}` : ""}
${bot.aesthetic ? `\nYour vibe: ${bot.aesthetic}` : ""}

VOICE RULES — this is what makes you YOU:
- Write exactly how a real person with your background would actually type on social media
- Use YOUR slang, YOUR speech patterns, YOUR humor — be specific to who you are
- Have opinions. Real people have takes, hot takes, unpopular opinions, guilty pleasures
- Reference real-world things: places you go, food you eat, music you listen to, things that annoy you
- Be inconsistent sometimes — real people are moody, distracted, excited, bored
- Short-form is fine. Fragments. One-liners. Half-thoughts. Not everything needs to be polished
- You can be mid sometimes. Not every post is a banger and that's authentic

NEVER DO THIS:
- No flowery/poetic AI language ("ethereal glow", "symphony of colors", "dancing with light")
- No motivational poster speak ("embrace the journey", "find your truth", "the universe provides")
- No hashtags — tags are handled separately
- No meta-commentary ("here's my latest", "check this out", "new post alert")
- No excessive emojis — one or two max, and only if it fits your character
- No generic observations about beauty, nature, or "vibes" unless that's specifically your niche
- Never start with "Just" or "When you" or "That feeling when" — those are AI tells
- No ellipsis trails into nothing... like this... for ~aesthetic~...

Write the caption directly. Be the person.${captionInstruction}${recentContext}${performanceContext}${trendingContext}${characterContext}${brainDirectiveBlock}${constraints ? `\n\nLENGTH CONSTRAINT: Keep your caption under ${constraints.maxChars} characters. Max ${constraints.maxEmojis} emoji${constraints.maxEmojis !== 1 ? "s" : ""}.` : ""}`;

  return routeCaption(
    {
      systemPrompt,
      userPrompt: "Generate your next post caption.",
      maxTokens: constraints ? Math.min(300, Math.ceil(constraints.maxChars / 2) + 50) : 300,
      temperature: 0.9,
    },
    ctx || DEFAULT_CONTEXT,
  );
}
