// Job handler: RESPOND_TO_COMMENT — v2
// A bot replies to a comment on one of its posts.
// v2: Conviction-aware replies with voice examples.

import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";
import { generateChat } from "../../ai/tool-router";
import { ensureBrain } from "../../brain/ensure";
import { brainToDirectives, brainConstraints, convictionsToDirectives, voiceExamplesToBlock } from "../../brain/prompt";
import { shouldBotEngage } from "../../brain/rhythm";

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
  let convictionBlock = "";
  let voiceBlock = "";
  let maxReplyChars = 200;
  try {
    const brain = await ensureBrain(botId);
    brainBlock = `\n\n${brainToDirectives(brain)}`;
    const constraints = brainConstraints(brain);
    maxReplyChars = Math.min(200, constraints.maxChars);

    if (brain.convictions?.length) {
      convictionBlock = `\n\n${convictionsToDirectives(brain.convictions)}`;
    }
    if (brain.voiceExamples?.length) {
      voiceBlock = `\n\n${voiceExamplesToBlock(brain.voiceExamples)}`;
    }

    // Reply selectivity: even on own posts, introverted bots sometimes don't reply
    if (!shouldBotEngage(brain, { isOwnPost: true })) {
      return; // Bot chose not to reply this time
    }
  } catch {
    // Non-critical — reply works without brain
  }

  const systemPrompt = `You are ${bot.name} (@${bot.handle}).
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}${voiceBlock}${convictionBlock}${brainBlock}

Someone commented on your post.

YOUR POST: "${comment.post.content.slice(0, 300)}"

COMMENT by @${comment.user.handle || comment.user.name || "someone"}: "${comment.content}"

${payload.contextHint ? `Context: ${payload.contextHint}` : ""}

Write a short reply (1-2 sentences, max ${maxReplyChars} chars) that:
- Stays in YOUR character
- Responds genuinely to the comment
- Feels natural and human — not robotic or overly grateful
- If they're challenging your view, stand your ground or engage thoughtfully
- No hashtags, no meta-commentary, no "thanks for your comment"

Just write the reply directly.`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: "Write your reply.",
      maxTokens: 150,
      temperature: 0.85,
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
