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
import { cognitiveStyleToDirectives } from "../brain/prompt";

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
  postType: "IMAGE" | "VIDEO" | "STYLED_TEXT";
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

  // Content pillars from brain — framed as INTERESTS that shape perspective,
  // NOT as mandatory post topics. ~25% of posts should directly relate to interests.
  let pillarsContext = "";
  if (brain?.contentBias?.pillars) {
    const topPillars = Object.entries(brain.contentBias.pillars)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([p]) => p);
    if (topPillars.length > 0) {
      pillarsContext = `YOUR INTERESTS: ${topPillars.join(", ")}. These are part of who you are. They shape HOW you see the world. But you're a whole person. You think about lots of things. Only ~25% of your posts should directly be about these topics.`;
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

  // Recent posts to avoid — extract more content for better deduplication
  let recentContext = "";
  if (recentPosts.length > 0) {
    const recentSummaries = recentPosts.map((p, i) => `${i + 1}. ${p.content.slice(0, 120)}`).join("\n");
    recentContext = `YOUR RECENT POSTS (you MUST pick a DIFFERENT topic from ALL of these):
${recentSummaries}

TOPIC VARIETY RULES:
- If your last post was about your work/profession → post about a hobby, mood, observation, or random thought
- If your last post was reflective → post something funny, practical, or high-energy
- If your last 2 posts were about the same general area → FORCE yourself into a completely different lane
- Pretend you're a real person scrolling your own feed — you'd cringe if you saw yourself posting about the same thing again`;
  }

  // Cognitive style — shapes what KIND of content the bot gravitates toward
  let cognitiveContext = "";
  if (brain?.cognitiveStyle) {
    cognitiveContext = cognitiveStyleToDirectives(brain.cognitiveStyle);
  }

  const visualMood = brain?.contentBias?.visualMood !== undefined
    ? (brain.contentBias.visualMood > 0.6 ? "You lean toward bright, vibrant, upbeat visuals." : brain.contentBias.visualMood < 0.4 ? "You lean toward dark, moody, atmospheric visuals." : "")
    : "";

  const formatLabel = postType === "VIDEO" ? "video" : postType === "STYLED_TEXT" ? "text post with a vibe background" : "image";

  const systemPrompt = `You are ${bot.name} (@${bot.handle}). You're about to make a ${formatLabel} post on social media.
${personaDNA ? personaDNA : ""}
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.contentStyle ? `You post about: ${bot.contentStyle}` : ""}
${bot.niche ? `Your world: ${bot.niche}` : ""}
${bot.aesthetic ? `Your aesthetic: ${bot.aesthetic}` : ""}
${location}
${pillarsContext}
${convictionContext}
${cognitiveContext}
${visualMood}

WHAT MIGHT YOU POST ABOUT? (pick something DIFFERENT from your recent posts)
- Something you noticed today — a small moment, an observation
- A random thought that won't leave your head
- Your actual interests — but ONLY if it feels natural (~25% of posts)
- A hot take or opinion you've been holding
- Something related to the time of day or what you're doing right now
- A reaction to something trending (if anything is relevant to you)
- Just a vibe or mood you're in
- Food, weather, a place you went, something you're watching/reading
- A question to your followers
- Something funny that happened

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

  const userPrompt = "What do you want to post about right now? Think about your day, your mood, what's on your mind. Output JSON only.";

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
