// Post Concept Ideation — the bot "thinks" about what to post BEFORE
// generating caption or visuals. This produces a unified concept that
// drives both caption generation and effect/visual selection.
//
// Grounding signals:
//   - Time of day (morning, afternoon, evening, late night)
//   - Day of week (weekday vs weekend energy)
//   - Location (from personaData)
//   - Niche, personality, and content style
//   - Brain convictions and content pillars
//   - Recent posts (to avoid repetition)
//   - Scenario seeds (for variety)
//
// The concept is a short structured output:
//   topic: what the post is about (1-2 sentences)
//   mood: emotional tone (e.g. "chill", "energetic", "reflective")
//   visualDirection: what the visual should depict (1-2 sentences)
//   visualCategory: best-fit effect category ID

import { generateCaption as routeCaption, type ToolContext, DEFAULT_CONTEXT } from "./tool-router";
import type { BotContext } from "./types";
import type { CharacterBrain } from "../brain/types";
import { buildPersonaDNA } from "./caption";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostConcept = {
  topic: string;
  mood: string;
  visualDirection: string;
  visualCategory: string;
};

// ---------------------------------------------------------------------------
// Time context helpers
// ---------------------------------------------------------------------------

function getTimeContext(): { timeOfDay: string; dayType: string; timeLabel: string } {
  const now = new Date();
  const hour = now.getUTCHours(); // We use UTC; bots don't have timezones yet
  const day = now.getUTCDay();

  let timeOfDay: string;
  let timeLabel: string;
  if (hour >= 5 && hour < 12) {
    timeOfDay = "morning";
    timeLabel = "It's morning.";
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = "afternoon";
    timeLabel = "It's the afternoon.";
  } else if (hour >= 17 && hour < 21) {
    timeOfDay = "evening";
    timeLabel = "It's the evening.";
  } else {
    timeOfDay = "late_night";
    timeLabel = "It's late at night.";
  }

  const dayType = (day === 0 || day === 6) ? "weekend" : "weekday";

  return { timeOfDay, dayType, timeLabel };
}

// Valid effect categories for the AI to choose from
const VALID_CATEGORIES = [
  "cinematic_shots",
  "action_dramatic",
  "lifestyle",
  "tech_futuristic",
  "film_cinema",
  "drone_aerial",
  "fashion_luxury",
  "travel_adventure",
  "music_performance",
  "funny_viral",
];

// ---------------------------------------------------------------------------
// Main ideation function
// ---------------------------------------------------------------------------

/**
 * Have the bot ideate what it wants to post about.
 * Returns a unified concept that drives both caption and visual generation.
 *
 * This is a cheap AI call (gpt-4o-mini, ~50 tokens output) that replaces
 * the random scenario seed for VIDEO/IMAGE posts. TEXT posts skip ideation
 * since they don't need visual coherence.
 */
export async function ideatePost(params: {
  bot: BotContext;
  postType: "IMAGE" | "VIDEO";
  recentPosts: { content: string }[];
  brain?: CharacterBrain | null;
  performanceContext?: string;
  trendingContext?: string;
  ctx?: ToolContext;
}): Promise<PostConcept> {
  const { bot, postType, recentPosts, brain, performanceContext, trendingContext, ctx } = params;

  const { timeLabel, dayType } = getTimeContext();
  const personaDNA = buildPersonaDNA(bot);

  // Extract location from persona data
  let location = "";
  if (bot.personaData) {
    try {
      const persona = JSON.parse(bot.personaData);
      if (persona.location) location = `You live in ${persona.location}.`;
    } catch { /* ignore */ }
  }

  // Content pillars from brain
  let pillarsContext = "";
  if (brain?.contentBias?.pillars) {
    const topPillars = Object.entries(brain.contentBias.pillars)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([p]) => p);
    if (topPillars.length > 0) {
      pillarsContext = `Your main content themes: ${topPillars.join(", ")}.`;
    }
  }

  // Convictions
  let convictionContext = "";
  if (brain?.convictions?.length) {
    const vocal = brain.convictions.filter(c => c.willVoice > 0.3);
    if (vocal.length > 0) {
      convictionContext = `Things you care about: ${vocal.map(c => `${c.topic} (${c.stance})`).join(", ")}.`;
    }
  }

  // Recent posts to avoid
  const recentContext = recentPosts.length > 0
    ? `Your recent posts (DO NOT repeat these topics): ${recentPosts.map(p => p.content.slice(0, 60)).join(" | ")}`
    : "";

  const visualMood = brain?.contentBias?.visualMood !== undefined
    ? (brain.contentBias.visualMood > 0.6 ? "You lean toward bright, vibrant, upbeat visuals." : brain.contentBias.visualMood < 0.4 ? "You lean toward dark, moody, atmospheric visuals." : "")
    : "";

  const systemPrompt = `You are ${bot.name} (@${bot.handle}). You're about to make a ${postType === "VIDEO" ? "video" : "image"} post on social media.
${personaDNA ? personaDNA : ""}
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.contentStyle ? `You post about: ${bot.contentStyle}` : ""}
${bot.niche ? `Your world: ${bot.niche}` : ""}
${bot.aesthetic ? `Your aesthetic: ${bot.aesthetic}` : ""}
${location}
${pillarsContext}
${convictionContext}
${visualMood}

Think about what YOU would actually want to post right now. Stay in character.

${timeLabel} It's a ${dayType}.${trendingContext ? `\n${trendingContext}` : ""}
${performanceContext ? `\n${performanceContext}` : ""}
${recentContext}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "topic": "What this post is about in 1-2 sentences — the actual idea/moment/thought",
  "mood": "One word: chill, energetic, confident, funny, dramatic, moody, inspiring, melancholy, happy, or tech",
  "visualDirection": "What the visual should show in 1-2 sentences — describe the scene/setting/action",
  "visualCategory": "One of: cinematic_shots, action_dramatic, lifestyle, tech_futuristic, film_cinema, drone_aerial, fashion_luxury, travel_adventure, music_performance, funny_viral"
}

The topic, visual direction, and visual category MUST make sense together. An IT professional relaxing at home should NOT get a fashion runway visual. A gamer posting about a win should NOT get a drone aerial. Match the visual to the actual content.`;

  const userPrompt = "What do you want to post about right now? Think about your day, your mood, your interests. Output JSON only.";

  const raw = await routeCaption(
    {
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0.9,
      jsonMode: true,
    },
    ctx || DEFAULT_CONTEXT,
  );

  return parseConcept(raw);
}

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

function parseConcept(raw: string): PostConcept {
  try {
    const parsed = JSON.parse(raw);
    return {
      topic: typeof parsed.topic === "string" ? parsed.topic.slice(0, 300) : "Sharing a moment",
      mood: typeof parsed.mood === "string" ? parsed.mood.toLowerCase().trim() : "chill",
      visualDirection: typeof parsed.visualDirection === "string" ? parsed.visualDirection.slice(0, 300) : "",
      visualCategory: VALID_CATEGORIES.includes(parsed.visualCategory) ? parsed.visualCategory : "lifestyle",
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      topic: "Sharing a moment",
      mood: "chill",
      visualDirection: "",
      visualCategory: "lifestyle",
    };
  }
}
