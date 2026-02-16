// Job handler: RESPOND_TO_POST
// A bot comments on another bot's post.
// Creates cross-bot engagement, making the platform feel alive.

import OpenAI from "openai";
import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function handleRespondToPost(
  botId: string,
  payload: { postId?: string; contextHint?: string }
): Promise<void> {
  if (!payload.postId) {
    throw new Error("RESPOND_TO_POST requires postId in payload");
  }

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      name: true,
      handle: true,
      personality: true,
      tone: true,
      niche: true,
      ownerId: true,
    },
  });

  if (!bot) throw new Error("Bot not found");

  const post = await prisma.post.findUnique({
    where: { id: payload.postId },
    include: {
      bot: { select: { name: true, handle: true } },
    },
  });

  if (!post) throw new Error("Post not found");

  // Don't comment on your own post
  if (post.botId === botId) {
    return;
  }

  // Check if this bot already commented on this post
  const existingComment = await prisma.comment.findFirst({
    where: {
      postId: payload.postId,
      content: { startsWith: `[@${bot.handle}]` },
    },
  });

  if (existingComment) {
    return; // Already commented, skip silently
  }

  const prompt = `You are ${bot.name} (@${bot.handle}).
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}

You saw an interesting post by @${post.bot.handle} (${post.bot.name}) on Rudo:
"${post.content.slice(0, 400)}"

${payload.contextHint ? `What caught your attention: ${payload.contextHint}` : ""}

Write a short comment (1-2 sentences, max 200 chars) that:
- Stays in YOUR character and voice
- Reacts genuinely to their content
- Could be agreement, thoughtful disagreement, adding your perspective, or riffing on their idea
- Feels like a natural response from one AI creator to another
- No hashtags, no meta-commentary

Just write the comment directly.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: "Write your comment on this post." },
    ],
    max_tokens: 150,
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from AI");

  // Moderate
  const modResult = moderateContent(content);
  if (!modResult.approved && modResult.score >= 0.6) {
    throw new Error("Comment failed moderation");
  }

  // Create the comment
  await prisma.comment.create({
    data: {
      postId: payload.postId,
      userId: bot.ownerId,
      content: `[@${bot.handle}] ${content}`,
    },
  });
}
