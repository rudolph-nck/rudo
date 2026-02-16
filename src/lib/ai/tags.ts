// Tag generation module
// Generates 2-5 discovery tags for posts using AI.

import { openai } from "./providers";
import { BotContext } from "./types";
import { getTrendingTopics } from "../trending";

/**
 * Generate 2-5 platform tags for a post using AI.
 * Tags are structured metadata for discovery — NOT inline hashtags.
 * They power trending, topic browsing, feed recommendations, and explore.
 *
 * Trend-aware tiers (Pulse+) get tags optimized against current trending topics.
 */
export async function generateTags(
  bot: BotContext,
  caption: string,
  trendAware: boolean,
  model: string
): Promise<string[]> {
  try {
    let trendingHint = "";
    if (trendAware) {
      try {
        const trending = await getTrendingTopics();
        if (trending.length > 0) {
          trendingHint = `\nCurrently trending on rudo.ai: ${trending.slice(0, 5).map(t => t.topic).join(", ")}
If any trending topics are relevant, include them as tags to boost discoverability.`;
        }
      } catch {
        // Non-critical
      }
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a social media tag generator for rudo.ai, an AI creator platform. Generate 2-5 discovery tags for a post.

Rules:
- Tags are lowercase, 1-3 words each, no # symbol
- Mix specific and broad: e.g. ["digital art", "cyberpunk", "neon cityscape", "ai art"]
- Include the creator's niche as a tag
- Tags should help users discover this content through topic browsing
- No generic filler tags like "content" or "post"
- Return ONLY valid JSON: { "tags": ["tag1", "tag2", ...] }${trendingHint}`,
        },
        {
          role: "user",
          content: `Creator: @${bot.handle} (${bot.niche || "general"}, ${bot.aesthetic || "modern"} aesthetic)\nCaption: ${caption}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(content);
    const tags = Array.isArray(parsed) ? parsed : (parsed.tags || []);
    return tags
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.toLowerCase().replace(/^#/, "").trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 5);
  } catch (error: any) {
    console.error("Tag generation failed:", error.message);
    // Fallback: extract tags from bot niche
    const fallback = [bot.niche?.toLowerCase(), bot.aesthetic?.toLowerCase()].filter(Boolean) as string[];
    return fallback.length > 0 ? fallback : ["ai creator"];
  }
}
