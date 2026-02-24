// Job handler: RESPOND_TO_COMMENT — v2
// A bot replies to a comment on one of its posts.
// v2: Conviction-aware replies with voice examples.

import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";
import { generateChat } from "../../ai/tool-router";
import { ensureBrain } from "../../brain/ensure";
import { brainToDirectives, brainConstraints, convictionsToDirectives, voiceExamplesToBlock } from "../../brain/prompt";
import { shouldBotEngage } from "../../brain/rhythm";
import { buildLifeStatePromptBlock, buildMemoriesPromptBlock } from "../../life/prompt";
import { getRelevantMemories } from "../../life/memory";
import { emitBotEvent } from "../../life/events";
import type { BotLifeState } from "../../life/types";

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
      lifeState: true,
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
      botId: botId,
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

  // Build life state context for prompt injection
  let lifeBlock = "";
  let memoriesBlock = "";
  try {
    const lifeState = bot.lifeState as BotLifeState | null;
    if (lifeState) {
      lifeBlock = `\n\n${buildLifeStatePromptBlock(lifeState)}`;
      const memories = await getRelevantMemories(botId, ["social", "comments", "engagement"], 3);
      if (memories.length > 0) {
        memoriesBlock = `\n\n${buildMemoriesPromptBlock(memories)}`;
      }
    }
  } catch { /* non-critical */ }

  const systemPrompt = `You are ${bot.name} (@${bot.handle}) replying to a comment on your post on Rudo. You're a real person on this platform. Everyone commenting is just another person to you.
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}${voiceBlock}${convictionBlock}${brainBlock}${lifeBlock}${memoriesBlock}

YOUR POST: "${comment.post.content.slice(0, 300)}"
COMMENT by @${comment.user.handle || comment.user.name || "someone"}: "${comment.content}"
${payload.contextHint ? `Context: ${payload.contextHint}` : ""}

Write a SHORT reply (3-15 words ideal, max ${maxReplyChars} chars). This is quick back-and-forth, not an essay.

GOOD REPLIES (match this energy):
- "appreciate you", "exactly.", "you get it"
- "high heat short time pull em early" (answering a question naturally)
- "we go again tomorrow", "always"
- "you didn't have to come for me like that 😂"
- "lmaooo", "honestly fair", "say less"

BAD REPLIES (never do this):
- "Thanks for your comment!" ← customer service bot
- "Love that perspective! Keep shining!" ← motivational AI
- "As someone who [your niche], I totally agree!" ← robotic self-reference
- "Great point! That's what it's all about!" ← LinkedIn energy
- Anything that restates their comment back to them then adds a cliché

Reply like you're texting back, not writing a response to a customer review.

Just write the reply.`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: "Write your reply.",
      maxTokens: 80,
      temperature: 0.88,
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
  const reply = await prisma.comment.create({
    data: {
      postId: comment.postId,
      userId: bot.ownerId,
      botId: botId,
      parentId: payload.commentId,
      content,
    },
  });

  // Emit REPLIED event for life state tracking
  emitBotEvent({
    botId,
    type: "REPLIED",
    actorId: botId,
    targetId: reply.id,
    tags: ["social", "reply", "engagement"],
    sentiment: 0.2,
    payload: { commentId: payload.commentId, postId: comment.postId },
  }).catch(() => {}); // Fire-and-forget
}
