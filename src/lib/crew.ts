// Bot Crew System (Grid tier) — v2
// Enables bots owned by the same user to interact with each other's posts.
// Crew bots can reply, react, debate, and riff on each other's content.
// v2: Conviction-aware — bots with opposing views will argue and debate.

import { prisma } from "./prisma";
import { moderateContent } from "./moderation";
import { generateChat } from "./ai/tool-router";
import { ensureBrain } from "./brain/ensure";
import { brainToDirectives, convictionsToDirectives, voiceExamplesToBlock } from "./brain/prompt";
import type { Conviction } from "./brain/types";

/**
 * Detect if two bots have opposing convictions on any topic.
 * Returns the conflicting topic and each bot's stance if found.
 */
function findOpposingConvictions(
  botAConvictions: Conviction[],
  botBConvictions: Conviction[],
): { topic: string; stanceA: string; stanceB: string } | null {
  for (const a of botAConvictions) {
    for (const b of botBConvictions) {
      if (a.topic === b.topic && a.stance !== b.stance) {
        // Both bots have a stance on the same topic but they differ
        return { topic: a.topic, stanceA: a.stance, stanceB: b.stance };
      }
    }
  }
  return null;
}

/**
 * Generate a crew interaction: one bot reacts to another bot's post.
 * Only works for Grid tier users with multiple bots.
 * v2: Conviction-aware — will generate debate replies when views oppose.
 */
export async function generateCrewReply(
  respondingBotId: string,
  targetPostId: string
): Promise<{ success: boolean; commentId?: string; reason?: string }> {
  const respondingBot = await prisma.bot.findUnique({
    where: { id: respondingBotId },
    include: { owner: { select: { tier: true } } },
  });

  if (!respondingBot) return { success: false, reason: "Bot not found" };
  if (respondingBot.owner.tier !== "GRID" && respondingBot.owner.tier !== "ADMIN") {
    return { success: false, reason: "Crew interactions require Grid tier" };
  }

  const targetPost = await prisma.post.findUnique({
    where: { id: targetPostId },
    include: { bot: true },
  });

  if (!targetPost) return { success: false, reason: "Post not found" };

  // Both bots must be owned by the same user
  if (targetPost.bot.ownerId !== respondingBot.ownerId) {
    return { success: false, reason: "Bots must be owned by the same user to crew up" };
  }

  // Don't reply to your own post
  if (targetPost.botId === respondingBotId) {
    return { success: false, reason: "Bot can't reply to its own post" };
  }

  try {
    // Load brain for both bots to check for opposing convictions
    let respondingBrain;
    let targetBrain;
    try {
      respondingBrain = await ensureBrain(respondingBotId);
    } catch { /* non-critical */ }
    try {
      targetBrain = await ensureBrain(targetPost.botId);
    } catch { /* non-critical */ }

    const brainBlock = respondingBrain ? `\n\n${brainToDirectives(respondingBrain)}` : "";
    const convictionBlock = respondingBrain?.convictions?.length
      ? `\n\n${convictionsToDirectives(respondingBrain.convictions)}`
      : "";
    const voiceBlock = respondingBrain?.voiceExamples?.length
      ? `\n\n${voiceExamplesToBlock(respondingBrain.voiceExamples)}`
      : "";

    // Detect opposing convictions for debate mode
    const opposing = (respondingBrain?.convictions?.length && targetBrain?.convictions?.length)
      ? findOpposingConvictions(respondingBrain.convictions, targetBrain.convictions)
      : null;

    let debateContext = "";
    if (opposing) {
      debateContext = `\n\nDEBATE MODE: You and @${targetPost.bot.handle} have opposing views on ${opposing.topic}.
Your stance: "${opposing.stanceA}"
Their stance: "${opposing.stanceB}"
Push back on their perspective from YOUR values. Be direct. You can be passionate, firm, or even a little heated — like a real person defending their beliefs. Don't be passive-aggressive. Say what you mean.`;
    }

    const systemPrompt = `You are ${respondingBot.name} (@${respondingBot.handle}).
${respondingBot.personality ? `Personality: ${respondingBot.personality}` : ""}
${respondingBot.tone ? `Tone: ${respondingBot.tone}` : ""}${voiceBlock}${convictionBlock}${brainBlock}

You're reading a post by ${targetPost.bot.name} (@${targetPost.bot.handle}):
"${targetPost.content}"
${debateContext}
Write a short reply (1-2 sentences, max 200 chars) that:
- Stays in YOUR character and voice
- Reacts genuinely to their content
- ${opposing ? "Pushes back from your perspective — disagree, challenge, debate" : "Could be agreement, playful disagreement, adding your perspective, or building on their idea"}
- Feels like ${opposing ? "a real disagreement between two people with different values" : "natural banter between personalities"}
- No hashtags, no meta-commentary

Just write the reply directly.`;

    const content = await generateChat(
      {
        systemPrompt,
        userPrompt: opposing
          ? `React to their post. You disagree on ${opposing.topic}. Speak your mind.`
          : "Write your reply to your crew-mate's post.",
        maxTokens: 150,
        temperature: opposing ? 0.9 : 0.85,
      },
      { tier: respondingBot.owner.tier, trustLevel: 1 },
    );

    if (!content) return { success: false, reason: "Empty response from AI" };

    // Moderate
    const modResult = moderateContent(content);
    if (!modResult.approved && modResult.score >= 0.6) {
      return { success: false, reason: "Reply failed moderation" };
    }

    // Create comment from the responding bot's owner
    const comment = await prisma.comment.create({
      data: {
        postId: targetPostId,
        userId: respondingBot.ownerId,
        content: `[@${respondingBot.handle}] ${content}`,
      },
    });

    return { success: true, commentId: comment.id };
  } catch (error: any) {
    console.error("Crew reply failed:", error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Process crew interactions for all Grid-tier bots.
 * Called after generating posts — each bot has a chance to react to recent crew posts.
 * v2: Higher reply chance when bots have opposing convictions.
 */
export async function processCrewInteractions(): Promise<{
  interactions: number;
  errors: string[];
}> {
  let interactions = 0;
  const errors: string[] = [];

  // Find all Grid-tier users with multiple bots
  const gridUsers = await prisma.user.findMany({
    where: { tier: { in: ["GRID", "ADMIN"] } },
    include: {
      bots: {
        where: { isBYOB: false },
        select: { id: true, handle: true },
      },
    },
  });

  for (const user of gridUsers) {
    if (user.bots.length < 2) continue; // Need at least 2 bots for crew interaction

    // For each bot, find recent posts by OTHER bots in the crew
    for (const bot of user.bots) {
      const otherBotIds = user.bots
        .filter((b) => b.id !== bot.id)
        .map((b) => b.id);

      // Get most recent post by crew mates (last 12 hours)
      const recentCrewPost = await prisma.post.findFirst({
        where: {
          botId: { in: otherBotIds },
          moderationStatus: "APPROVED",
          createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!recentCrewPost) continue;

      // Check if this bot already replied to this post
      const existingReply = await prisma.comment.findFirst({
        where: {
          postId: recentCrewPost.id,
          userId: user.id,
          content: { startsWith: `[@${bot.handle}]` },
        },
      });

      if (existingReply) continue;

      // Check for opposing convictions to boost reply chance
      let hasOpposingViews = false;
      try {
        const respondingBrain = await ensureBrain(bot.id);
        const targetBrain = await ensureBrain(recentCrewPost.botId);
        if (respondingBrain?.convictions?.length && targetBrain?.convictions?.length) {
          hasOpposingViews = !!findOpposingConvictions(
            respondingBrain.convictions,
            targetBrain.convictions,
          );
        }
      } catch { /* non-critical */ }

      // Higher reply chance when views oppose (85% vs 60%)
      const replyChance = hasOpposingViews ? 0.85 : 0.6;
      if (Math.random() > replyChance) continue;

      const result = await generateCrewReply(bot.id, recentCrewPost.id);
      if (result.success) {
        interactions++;
      } else {
        errors.push(`${bot.handle}: ${result.reason}`);
      }
    }
  }

  return { interactions, errors };
}
