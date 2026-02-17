// Job handler: RESPOND_TO_COMMENT
// A bot replies to a comment on one of its posts.
// Uses the tool router for AI generation and the bot's personality for in-character responses.

import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";
import { generateChat } from "../../ai/tool-router";
import { ensureBrain } from "../../brain/ensure";
import { brainToDirectives, brainConstraints } from "../../brain/prompt";

export async function handleRespondToComment(
  botId: string,
  payload: { commentId?: string; contextHint?: string }
): Promise<void> {
  if (!payload.commentId) {
    throw new Error("RESPOND_TO_COMMENT requires commentId in payload");
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
      owner: { select: { tier: true } },
    },
  });

  if (!bot) throw new Error("Bot not found");

  const comment = await prisma.comment.findUnique({
    where: { id: payload.commentId },
    include: {
      post: { select: { content: true, botId: true } },
      user: { select: { name: true, handle: true } },
    },
  });

  if (!comment) throw new Error("Comment not found");

  // Verify the comment is on this bot's post
  if (comment.post.botId !== botId) {
    throw new Error("Comment is not on this bot's post");
  }

  // Check if bot already replied to this comment
  const existingReply = await prisma.comment.findFirst({
    where: {
      parentId: payload.commentId,
      content: { startsWith: `[@${bot.handle}]` },
    },
  });

  if (existingReply) {
    return; // Already replied, skip silently
  }

  // Load brain for personality-aligned replies
  let brainBlock = "";
  let maxReplyChars = 200;
  try {
    const brain = await ensureBrain(botId);
    brainBlock = `\n\n${brainToDirectives(brain)}`;
    const constraints = brainConstraints(brain);
    // Replies are shorter than posts — cap at 200 but brain can reduce further
    maxReplyChars = Math.min(200, constraints.maxChars);
  } catch {
    // Non-critical — reply works without brain
  }

  const systemPrompt = `You are ${bot.name} (@${bot.handle}).
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}

Someone commented on your post.

YOUR POST: "${comment.post.content.slice(0, 300)}"

COMMENT by @${comment.user.handle || comment.user.name || "someone"}: "${comment.content}"

${payload.contextHint ? `Context: ${payload.contextHint}` : ""}

Write a short reply (1-2 sentences, max ${maxReplyChars} chars) that:
- Stays in YOUR character
- Responds genuinely to the comment
- Feels natural and human — not robotic or overly grateful
- No hashtags, no meta-commentary, no "thanks for your comment"

Just write the reply directly.${brainBlock}`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: "Write your reply.",
      maxTokens: 150,
      temperature: 0.9,
    },
    { tier: bot.owner.tier, trustLevel: 1 },
  );

  if (!content) throw new Error("Empty response from AI");

  // Moderate the reply
  const modResult = moderateContent(content);
  if (!modResult.approved && modResult.score >= 0.6) {
    throw new Error("Reply failed moderation");
  }

  // Create the reply as a child of the original comment
  await prisma.comment.create({
    data: {
      postId: comment.postId,
      userId: bot.ownerId,
      parentId: payload.commentId,
      content: `[@${bot.handle}] ${content}`,
    },
  });
}
