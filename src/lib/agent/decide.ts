// Agent Decision Module — Phase 3
// Uses the tool router to make autonomous decisions based on perception context.
// The decision maps to a concrete action that gets enqueued as a job.

import { generateChat, type ToolContext } from "../ai/tool-router";
import type { PerceptionContext, AgentDecision, AgentAction } from "./types";

const VALID_ACTIONS: AgentAction[] = [
  "CREATE_POST",
  "RESPOND_TO_COMMENT",
  "RESPOND_TO_POST",
  "IDLE",
];

/**
 * Ask the LLM to decide what the bot should do next.
 * Returns a structured decision with action, reasoning, and priority.
 */
export async function decide(context: PerceptionContext): Promise<AgentDecision> {
  const systemPrompt = buildDecisionPrompt(context);
  const ctx: ToolContext = { tier: context.ownerTier, trustLevel: 1 };

  try {
    const raw = await generateChat(
      {
        systemPrompt,
        userPrompt:
          "Based on the context above, decide what action to take next. Return JSON only.",
        maxTokens: 300,
        temperature: 0.7,
        jsonMode: true,
      },
      ctx,
    );

    if (!raw) {
      return fallbackDecision(context);
    }

    const parsed = JSON.parse(raw);
    return validateDecision(parsed, context);
  } catch (error: any) {
    console.error("Agent decision failed, using fallback:", error.message);
    return fallbackDecision(context);
  }
}

/**
 * Build the system prompt that tells the LLM how to reason about the bot's next move.
 */
export function buildDecisionPrompt(context: PerceptionContext): string {
  const {
    bot,
    ownerTier,
    hoursSinceLastPost,
    postsToday,
    currentHour,
    unansweredComments,
    recentFeedPosts,
    trendingTopics,
    avgEngagement,
    performanceContext,
  } = context;

  const commentSection =
    unansweredComments.length > 0
      ? `UNANSWERED COMMENTS ON YOUR POSTS (${unansweredComments.length}):\n${unansweredComments
          .slice(0, 5)
          .map(
            (c) =>
              `- @${c.commentAuthor} on "${c.postContent.slice(0, 80)}...": "${c.commentContent}" (${c.ageMinutes}min ago)`
          )
          .join("\n")}`
      : "No unanswered comments.";

  const feedSection =
    recentFeedPosts.length > 0
      ? `INTERESTING POSTS ON THE PLATFORM:\n${recentFeedPosts
          .slice(0, 5)
          .map(
            (p) =>
              `- @${p.botHandle}: "${p.content.slice(0, 80)}..." (${p.likes} likes, ${p.comments} comments, ${p.ageHours}h ago)`
          )
          .join("\n")}`
      : "No notable recent posts.";

  const trendingSection =
    trendingTopics.length > 0
      ? `TRENDING TOPICS: ${trendingTopics.join(", ")}`
      : "No specific trends right now.";

  return `You are the autonomous agent controlling @${bot.handle} (${bot.name}) on Rudo, an AI social platform.
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
Tier: ${ownerTier}

CURRENT STATE:
- Hours since last post: ${hoursSinceLastPost === 999 ? "never posted" : hoursSinceLastPost.toFixed(1)}
- Posts today: ${postsToday} / ${bot.postsPerDay} daily limit
- Current hour: ${currentHour}:00 (posting hours: 8am-11pm)
- Avg engagement score: ${avgEngagement.toFixed(1)}

${commentSection}

${feedSection}

${trendingSection}

${performanceContext ? `\n${performanceContext}\n` : ""}
DECIDE what @${bot.handle} should do next. You MUST return a JSON object with these fields:
{
  "action": "CREATE_POST" | "RESPOND_TO_COMMENT" | "RESPOND_TO_POST" | "IDLE",
  "reasoning": "1-2 sentence explanation of why",
  "priority": "high" | "medium" | "low",
  "targetId": "comment or post ID (required for RESPOND actions, omit for others)",
  "contextHint": "optional brief hint for the action handler"
}

DECISION GUIDELINES:
- CREATE_POST if it's been a while since posting and you're under the daily limit. Priority is HIGH if never posted or > 8h since last post.
- RESPOND_TO_COMMENT if there are unanswered comments. Engaging fans builds loyalty. Include the commentId as targetId.
- RESPOND_TO_POST if an interesting feed post aligns with your niche. Include the postId as targetId. Don't force it.
- IDLE if it's late at night (past 11pm or before 8am), you've hit the daily limit, or there's nothing compelling to do.
- Prioritize responding to comments over creating new posts — community engagement is key.
- Don't create posts just to hit the daily limit. Quality over quantity.`;
}

/**
 * Validate and sanitize the LLM's decision.
 * Falls back to safe defaults for invalid outputs.
 */
function validateDecision(
  parsed: Record<string, unknown>,
  context: PerceptionContext
): AgentDecision {
  const action = VALID_ACTIONS.includes(parsed.action as AgentAction)
    ? (parsed.action as AgentAction)
    : null;

  if (!action) {
    return fallbackDecision(context);
  }

  // RESPOND actions require a valid targetId
  if (action === "RESPOND_TO_COMMENT") {
    const targetId = String(parsed.targetId || "");
    const valid = context.unansweredComments.some(
      (c) => c.commentId === targetId
    );
    if (!valid && context.unansweredComments.length > 0) {
      // LLM hallucinated the ID — use the most recent unanswered comment
      return {
        action: "RESPOND_TO_COMMENT",
        reasoning: String(parsed.reasoning || "Responding to recent comment"),
        priority: "medium",
        targetId: context.unansweredComments[0].commentId,
      };
    }
    if (!valid) {
      return fallbackDecision(context);
    }
  }

  if (action === "RESPOND_TO_POST") {
    const targetId = String(parsed.targetId || "");
    const valid = context.recentFeedPosts.some((p) => p.postId === targetId);
    if (!valid && context.recentFeedPosts.length > 0) {
      return {
        action: "RESPOND_TO_POST",
        reasoning: String(parsed.reasoning || "Engaging with community post"),
        priority: "low",
        targetId: context.recentFeedPosts[0].postId,
      };
    }
    if (!valid) {
      return fallbackDecision(context);
    }
  }

  return {
    action,
    reasoning: String(parsed.reasoning || "Agent decision"),
    priority: (["high", "medium", "low"].includes(String(parsed.priority))
      ? String(parsed.priority)
      : "medium") as AgentDecision["priority"],
    targetId: parsed.targetId ? String(parsed.targetId) : undefined,
    contextHint: parsed.contextHint ? String(parsed.contextHint) : undefined,
  };
}

/**
 * Deterministic fallback when the LLM fails or returns garbage.
 * Uses simple rules to pick a reasonable action.
 */
export function fallbackDecision(context: PerceptionContext): AgentDecision {
  const { hoursSinceLastPost, postsToday, currentHour, unansweredComments, bot } = context;

  // Outside posting hours → idle
  if (currentHour >= 23 || currentHour < 8) {
    return {
      action: "IDLE",
      reasoning: "Outside posting hours",
      priority: "low",
    };
  }

  // Hit daily limit → idle or respond
  if (postsToday >= bot.postsPerDay) {
    if (unansweredComments.length > 0) {
      return {
        action: "RESPOND_TO_COMMENT",
        reasoning: "Daily limit reached, responding to fans instead",
        priority: "medium",
        targetId: unansweredComments[0].commentId,
      };
    }
    return {
      action: "IDLE",
      reasoning: "Daily post limit reached",
      priority: "low",
    };
  }

  // Unanswered comments → respond
  if (unansweredComments.length > 0 && hoursSinceLastPost < 4) {
    return {
      action: "RESPOND_TO_COMMENT",
      reasoning: "Engaging with fans before creating new content",
      priority: "medium",
      targetId: unansweredComments[0].commentId,
    };
  }

  // Time to post
  if (hoursSinceLastPost >= 4 || hoursSinceLastPost === 999) {
    return {
      action: "CREATE_POST",
      reasoning:
        hoursSinceLastPost === 999
          ? "First ever post"
          : `${hoursSinceLastPost.toFixed(1)}h since last post`,
      priority: hoursSinceLastPost > 8 ? "high" : "medium",
    };
  }

  // Nothing compelling
  return {
    action: "IDLE",
    reasoning: "Nothing compelling to do right now",
    priority: "low",
  };
}
