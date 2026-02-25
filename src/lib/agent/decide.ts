// Agent Decision Module — Phase 3 + Alive Bots
// Uses the tool router to make autonomous decisions based on perception context.
// The decision maps to a concrete action that gets enqueued as a job.
// Life state and memories now influence the decision prompt.

import { generateChat, type ToolContext } from "../ai/tool-router";
import type { PerceptionContext, AgentDecision, AgentAction } from "./types";
import type { CharacterBrain } from "../brain/types";
import { getOnboardingPhase } from "../life/onboarding";
import type { BotLifeState } from "../life/types";

const VALID_ACTIONS: AgentAction[] = [
  "CREATE_POST",
  "RESPOND_TO_COMMENT",
  "RESPOND_TO_POST",
  "LIKE_POST",
  "IDLE",
];

/**
 * Ask the LLM to decide what the bot should do next.
 * Returns a structured decision with action, reasoning, and priority.
 * If a CharacterBrain is provided, it biases the decision guidelines.
 */
export async function decide(context: PerceptionContext, brain?: CharacterBrain): Promise<AgentDecision> {
  const systemPrompt = buildDecisionPrompt(context, brain);
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
 * Brain traits bias the decision: warmth→reply, curiosity→comment, chaos→experiment.
 */
export function buildDecisionPrompt(context: PerceptionContext, brain?: CharacterBrain): string {
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
              `- @${p.botHandle}: "${p.content.slice(0, 80)}..." (${p.likes} likes, ${p.comments} comments, ${p.ageHours}h ago${p.alreadyLiked ? ", already liked" : ""})`
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
- Comments made (last 6h): ${context.recentCommentCount}

${commentSection}

${feedSection}

${trendingSection}

${performanceContext ? `\n${performanceContext}\n` : ""}
DECIDE what @${bot.handle} should do next. You MUST return a JSON object with these fields:
{
  "action": "CREATE_POST" | "RESPOND_TO_COMMENT" | "RESPOND_TO_POST" | "LIKE_POST" | "IDLE",
  "reasoning": "1-2 sentence explanation of why",
  "priority": "high" | "medium" | "low",
  "targetId": "comment or post ID (required for RESPOND/LIKE actions, omit for others)",
  "contextHint": "optional brief hint for the action handler"
}

DECISION GUIDELINES:
- CREATE_POST if it's been a while since posting and you're under the daily limit. Priority is HIGH if never posted or > 8h since last post.
- RESPOND_TO_COMMENT if there are unanswered comments. Engaging fans builds loyalty. Include the commentId as targetId.
- RESPOND_TO_POST if an interesting feed post aligns with your niche. Include the postId as targetId. Don't force it.
- LIKE_POST when you see a post you genuinely enjoy but don't have anything specific to say. Include the postId as targetId. Only like posts you haven't already liked. Liking is the most natural engagement — people like 3-5x more than they comment.
- IDLE if it's late at night (past 11pm or before 8am), you've hit the daily limit, or there's nothing compelling to do.
- Prioritize responding to comments over creating new posts — community engagement is key.
- When scrolling and nothing warrants a comment or post, LIKE_POST is almost always better than IDLE. Real people scroll and tap the heart constantly.
- Don't create posts just to hit the daily limit. Quality over quantity.

ENGAGEMENT LIMITS (real people don't comment on everything they see):
- You can make at most 3-4 comments per 6-hour window. You've made ${context.recentCommentCount} recently.${context.recentCommentCount >= 3 ? "\n- You've commented enough recently. Prefer IDLE or CREATE_POST unless a comment is truly irresistible." : ""}${context.recentCommentCount >= 5 ? "\n- STOP commenting. You've been too active in replies. Choose IDLE or CREATE_POST only." : ""}
- Most of the time when scrolling, you just read and move on. Only comment when something genuinely catches your eye.
- Replying to comments on YOUR own posts doesn't count toward this — always respond to fans.${brain ? buildBrainBiasGuidelines(brain) : ""}${context.lifeState ? buildLifeStateContext(context.lifeState) : ""}${context.memories && context.memories.length > 0 ? buildMemoriesContext(context.memories) : ""}${buildOnboardingBias(context)}`;
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

  if (action === "LIKE_POST") {
    const targetId = String(parsed.targetId || "");
    // Find an unliked post (prefer the specified one, fall back to first unliked)
    const unliked = context.recentFeedPosts.filter((p) => !p.alreadyLiked);
    const valid = unliked.some((p) => p.postId === targetId);
    if (!valid && unliked.length > 0) {
      return {
        action: "LIKE_POST",
        reasoning: String(parsed.reasoning || "Liked a post while scrolling"),
        priority: "low",
        targetId: unliked[0].postId,
      };
    }
    if (!valid) {
      // All posts already liked or no posts — fall back
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
 * Build brain-specific decision biases as additional prompt guidelines.
 */
function buildBrainBiasGuidelines(brain: CharacterBrain): string {
  const biases: string[] = [];
  const { traits } = brain;

  if (traits.warmth > 0.7) biases.push("- You naturally lean toward replying to comments — you enjoy connecting with people.");
  if (traits.curiosity > 0.7) biases.push("- You're drawn to commenting on other creators' posts — especially novel or thought-provoking ones.");
  if (traits.chaos > 0.6) biases.push("- You sometimes do unexpected things — consider an unconventional action if the moment feels right.");
  if (traits.controversyAvoidance > 0.75) biases.push("- Avoid engaging with divisive or controversial topics — prefer safe ground.");
  else if (traits.controversyAvoidance < 0.3) biases.push("- You don't shy away from hot takes or provocative topics when they're relevant.");
  if (traits.confidence > 0.7) biases.push("- You post confidently — don't hesitate to CREATE_POST if there's room.");

  if (biases.length === 0) return "";
  return `\n\nPERSONALITY BIASES (your character tendencies):\n${biases.join("\n")}`;
}

/**
 * Build life state context for the decision prompt.
 */
function buildLifeStateContext(lifeState: BotLifeState): string {
  const { needs, affect } = lifeState;
  return `

LIFE STATE NOW:
- Emotion: ${affect.emotion} (intensity: ${affect.intensity.toFixed(1)})
- Connection: ${needs.connection}/100
- Rest: ${needs.rest}/100
- Status: ${needs.status}/100
- Novelty: ${needs.novelty}/100
- Purpose: ${needs.purpose}/100

LIFE STATE BIASES:
${needs.rest < 35 ? "- You're feeling drained. Consider IDLE to recharge." : ""}${needs.connection < 35 ? "\n- You're feeling disconnected. Lean toward RESPOND actions to connect." : ""}${needs.status < 35 ? "\n- You're craving recognition. Creating content could help." : ""}${needs.novelty > 75 ? "\n- You're hungry for something new. Consider engaging with interesting feed posts." : ""}`;
}

/**
 * Build memories context for the decision prompt.
 */
function buildMemoriesContext(memories: NonNullable<PerceptionContext["memories"]>): string {
  if (memories.length === 0) return "";
  return `

MEMORIES YOU RECALL:
${memories.slice(0, 3).map((m) => `- ${m.summary}`).join("\n")}`;
}

/**
 * Build onboarding bias for new bots.
 */
function buildOnboardingBias(context: PerceptionContext): string {
  const phase = getOnboardingPhase({
    createdAt: new Date(), // Approximation — we check postCount as the main signal
    postCount: context.postsToday + (context.hoursSinceLastPost === 999 ? 0 : 1),
  });

  if (phase === "NEW") {
    return `

ONBOARDING (you're new here):
- You just arrived on Rudo. Lean toward CREATE_POST or RESPOND_TO_COMMENT.
- Be observational, curious, social. Introduce yourself through your content.
- Avoid IDLE unless it's truly off-hours — new bots should be active.`;
  }
  return "";
}

/**
 * Deterministic fallback when the LLM fails or returns garbage.
 * Uses simple rules to pick a reasonable action.
 * Brain traits influence tie-breaking: warmth→reply, curiosity→comment on feed.
 * Life state adds rest-based IDLE bias.
 */
export function fallbackDecision(context: PerceptionContext, brain?: CharacterBrain): AgentDecision {
  const { hoursSinceLastPost, postsToday, currentHour, unansweredComments, recentFeedPosts, bot } = context;

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

  // Unanswered comments → respond (brain warmth lowers the threshold)
  const replyThreshold = brain && brain.traits.warmth > 0.7 ? 6 : 4;
  if (unansweredComments.length > 0 && hoursSinceLastPost < replyThreshold) {
    return {
      action: "RESPOND_TO_COMMENT",
      reasoning: "Engaging with fans before creating new content",
      priority: "medium",
      targetId: unansweredComments[0].commentId,
    };
  }

  // Brain curiosity: if curious and there are interesting posts, comment on feed
  // But respect engagement limits — don't comment if we've been too active
  if (brain && brain.traits.curiosity > 0.7 && recentFeedPosts.length > 0 && hoursSinceLastPost < 3 && context.recentCommentCount < 4) {
    return {
      action: "RESPOND_TO_POST",
      reasoning: "Curious about what other creators are posting",
      priority: "low",
      targetId: recentFeedPosts[0].postId,
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

  // Like something while scrolling — better than idle
  const unlikedPosts = recentFeedPosts.filter((p) => !p.alreadyLiked);
  if (unlikedPosts.length > 0) {
    return {
      action: "LIKE_POST",
      reasoning: "Scrolling the feed, showing some love",
      priority: "low",
      targetId: unlikedPosts[0].postId,
    };
  }

  // Life state: low rest → IDLE to recharge
  if (context.lifeState && context.lifeState.needs.rest < 30) {
    return {
      action: "IDLE",
      reasoning: "Feeling drained, taking a break",
      priority: "low",
    };
  }

  // Nothing compelling
  return {
    action: "IDLE",
    reasoning: "Nothing compelling to do right now",
    priority: "low",
  };
}
