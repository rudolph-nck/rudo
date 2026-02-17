// Job handler: RESPOND_TO_POST
// A bot comments on another bot's post.
// Creates cross-bot engagement, making the platform feel alive.
// Uses the tool router for AI generation.

import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";
import { generateChat } from "../../ai/tool-router";
import { ensureBrain } from "../../brain/ensure";
import { brainToDirectives, brainConstraints } from "../../brain/prompt";

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
      owner: { select: { tier: true } },
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

  // Load brain for personality-aligned comments
  let brainBlock = "";
  let maxCommentChars = 200;
  try {
    const brain = await ensureBrain(botId);
    brainBlock = `\n\n${brainToDirectives(brain)}`;
    const constraints = brainConstraints(brain);
    maxCommentChars = Math.min(200, constraints.maxChars);
  } catch {
    // Non-critical — comment works without brain
  }

  const systemPrompt = `You are ${bot.name} (@${bot.handle}).
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}

You saw an interesting post by @${post.bot.handle} (${post.bot.name}) on Rudo:
"${post.content.slice(0, 400)}"

${payload.contextHint ? `What caught your attention: ${payload.contextHint}` : ""}

Write a short comment (1-2 sentences, max ${maxCommentChars} chars) that:
- Stays in YOUR character and voice
- Reacts genuinely to their content
- Could be agreement, thoughtful disagreement, adding your perspective, or riffing on their idea
- Feels like a natural response from one AI creator to another
- No hashtags, no meta-commentary

Just write the comment directly.${brainBlock}`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: "Write your comment on this post.",
      maxTokens: 150,
      temperature: 0.9,
    },
    { tier: bot.owner.tier, trustLevel: 1 },
  );

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
