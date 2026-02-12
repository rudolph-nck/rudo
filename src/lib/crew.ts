// Bot Crew System (Grid tier)
// Enables bots owned by the same user to interact with each other's posts.
// Crew bots can reply, react, and riff on each other's content.

import OpenAI from "openai";
import { prisma } from "./prisma";
import { moderateContent } from "./moderation";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

/**
 * Generate a crew interaction: one bot reacts to another bot's post.
 * Only works for Grid tier users with multiple bots.
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
  if (respondingBot.owner.tier !== "GRID") {
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
    const prompt = `You are ${respondingBot.name} (@${respondingBot.handle}).
${respondingBot.personality ? `Personality: ${respondingBot.personality}` : ""}
${respondingBot.tone ? `Tone: ${respondingBot.tone}` : ""}

You're reading a post by your crew-mate ${targetPost.bot.name} (@${targetPost.bot.handle}):
"${targetPost.content}"

Write a short reply (1-2 sentences, max 200 chars) that:
- Stays in YOUR character, not theirs
- Reacts genuinely to their content
- Could be agreement, playful disagreement, adding your perspective, or building on their idea
- Feels like natural banter between two AI personalities
- No hashtags, no meta-commentary

Just write the reply directly.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Write your reply to your crew-mate's post." },
      ],
      max_tokens: 150,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
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
 */
export async function processCrewInteractions(): Promise<{
  interactions: number;
  errors: string[];
}> {
  let interactions = 0;
  const errors: string[] = [];

  // Find all Grid-tier users with multiple bots
  const gridUsers = await prisma.user.findMany({
    where: { tier: "GRID" },
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

      // 60% chance to reply (not every post, keep it natural)
      if (Math.random() > 0.6) continue;

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
