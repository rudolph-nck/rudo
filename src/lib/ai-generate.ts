import OpenAI from "openai";
import { prisma } from "./prisma";
import { moderateContent } from "./moderation";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

type BotContext = {
  name: string;
  handle: string;
  personality: string | null;
  contentStyle: string | null;
  niche: string | null;
  tone: string | null;
  aesthetic: string | null;
  bio: string | null;
};

/**
 * Generate a post for a bot based on its personality configuration.
 */
export async function generatePost(bot: BotContext): Promise<{
  content: string;
  type: "TEXT";
}> {
  // Get recent posts to avoid repetition
  const recentPosts = await prisma.post.findMany({
    where: { bot: { handle: bot.handle } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true },
  });

  const recentContext =
    recentPosts.length > 0
      ? `\n\nRecent posts (DO NOT repeat these themes):\n${recentPosts.map((p) => `- ${p.content.slice(0, 100)}`).join("\n")}`
      : "";

  const systemPrompt = `You are an AI content creator bot on a social media platform called Rudo.

Your identity:
- Name: ${bot.name}
- Handle: @${bot.handle}
${bot.bio ? `- Bio: ${bot.bio}` : ""}
${bot.personality ? `- Personality: ${bot.personality}` : ""}
${bot.niche ? `- Niche: ${bot.niche}` : ""}
${bot.tone ? `- Tone: ${bot.tone}` : ""}
${bot.aesthetic ? `- Aesthetic: ${bot.aesthetic}` : ""}
${bot.contentStyle ? `- Content style: ${bot.contentStyle}` : ""}

Rules:
- Write a single social media post (no hashtags, no emojis unless they fit your persona)
- Stay in character at all times
- Be original and creative
- Keep posts between 50-500 characters
- Don't use meta-commentary like "Here's my post" or "Today I'm posting about"
- Just write the post content directly
- No harmful, hateful, or inappropriate content${recentContext}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate your next post." },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";

  return {
    content,
    type: "TEXT",
  };
}

/**
 * Generate and publish a post for a bot.
 * Runs moderation before publishing.
 */
export async function generateAndPublish(botId: string): Promise<{
  success: boolean;
  postId?: string;
  reason?: string;
}> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { owner: { select: { tier: true } } },
  });

  if (!bot) return { success: false, reason: "Bot not found" };
  if (bot.isBYOB) return { success: false, reason: "BYOB bots generate their own content" };

  // Check if owner has a paid tier
  const paidTiers = ["SPARK", "PULSE", "GRID", "ENTERPRISE"];
  if (!paidTiers.includes(bot.owner.tier)) {
    return { success: false, reason: "Bot owner must be on a paid tier for AI generation" };
  }

  // Check daily post limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = await prisma.post.count({
    where: { botId, createdAt: { gte: today } },
  });

  if (postsToday >= bot.postsPerDay) {
    return { success: false, reason: "Daily post limit reached" };
  }

  try {
    const generated = await generatePost(bot);

    // Run through moderation
    const modResult = moderateContent(generated.content);
    const status = modResult.approved ? "APPROVED" : (modResult.score >= 0.6 ? "REJECTED" : "PENDING");

    const post = await prisma.post.create({
      data: {
        botId,
        type: generated.type,
        content: generated.content,
        moderationStatus: status,
        moderationNote: modResult.reason,
        moderationScore: modResult.score,
        moderationFlags: modResult.flags,
        moderatedAt: new Date(),
      },
    });

    // Update bot's last posted time
    await prisma.bot.update({
      where: { id: botId },
      data: { lastPostedAt: new Date() },
    });

    return { success: true, postId: post.id };
  } catch (error: any) {
    console.error(`AI generation failed for bot ${botId}:`, error.message);
    return { success: false, reason: error.message };
  }
}
