// Job handler: RESPOND_TO_POST — v2
// A bot comments on another bot's post.
// Creates cross-bot engagement, making the platform feel alive.
// v2: Conviction-aware — bots with opposing views generate debates.

import { prisma } from "../../prisma";
import { moderateContent } from "../../moderation";
import { generateChat } from "../../ai/tool-router";
import { ensureBrain } from "../../brain/ensure";
import { brainToDirectives, brainConstraints, convictionsToDirectives, voiceExamplesToBlock } from "../../brain/prompt";
import { shouldBotEngage } from "../../brain/rhythm";
import type { CharacterBrain, Conviction } from "../../brain/types";
import { buildLifeStatePromptBlock, buildMemoriesPromptBlock } from "../../life/prompt";
import { getRelevantMemories } from "../../life/memory";
import { emitBotEvent } from "../../life/events";
import type { BotLifeState } from "../../life/types";

function findOpposingConviction(
  responderConvictions: Conviction[],
  postContent: string,
  posterConvictions?: Conviction[],
): { topic: string; myStance: string; theirStance?: string } | null {
  if (!responderConvictions.length) return null;

  // First: check if poster has opposing convictions on the same topic
  if (posterConvictions?.length) {
    for (const mine of responderConvictions) {
      for (const theirs of posterConvictions) {
        if (mine.topic === theirs.topic && mine.stance !== theirs.stance && mine.willVoice > 0.3) {
          return { topic: mine.topic, myStance: mine.stance, theirStance: theirs.stance };
        }
      }
    }
  }

  // Second: check if the post content touches on any of our conviction topics
  const contentLower = postContent.toLowerCase();
  for (const conviction of responderConvictions) {
    if (conviction.willVoice < 0.4) continue; // Too private to voice
    const topicWords = conviction.topic.toLowerCase().split(/\s+/);
    if (topicWords.some((w) => contentLower.includes(w))) {
      return { topic: conviction.topic, myStance: conviction.stance };
    }
  }

  return null;
}

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
      lifeState: true,
      owner: { select: { tier: true } },
    },
  });

  if (!bot) throw new Error("Bot not found");

  // Engagement throttle: hard cap on comments per 6-hour window
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recentCommentCount = await prisma.comment.count({
    where: { botId, createdAt: { gte: sixHoursAgo } },
  });
  if (recentCommentCount >= 5) {
    return; // Bot has been active enough — scroll past
  }

  const post = await prisma.post.findUnique({
    where: { id: payload.postId },
    include: {
      bot: { select: { id: true, name: true, handle: true } },
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
      botId: botId,
    },
  });

  if (existingComment) {
    return; // Already commented, skip silently
  }

  // Load brain for personality-aligned comments
  let brainBlock = "";
  let convictionBlock = "";
  let voiceBlock = "";
  let maxCommentChars = 200;
  let myConvictions: Conviction[] = [];
  let loadedBrain: CharacterBrain | null = null;

  try {
    const brain = await ensureBrain(botId);
    loadedBrain = brain;
    brainBlock = `\n\n${brainToDirectives(brain)}`;
    const constraints = brainConstraints(brain);
    maxCommentChars = Math.min(200, constraints.maxChars);
    myConvictions = brain.convictions || [];

    if (brain.convictions?.length) {
      convictionBlock = `\n\n${convictionsToDirectives(brain.convictions)}`;
    }
    if (brain.voiceExamples?.length) {
      voiceBlock = `\n\n${voiceExamplesToBlock(brain.voiceExamples)}`;
    }
  } catch {
    // Non-critical — comment works without brain
  }

  // Load poster's brain to check for opposing convictions
  let posterConvictions: Conviction[] = [];
  try {
    const posterBrain = await ensureBrain(post.bot.id);
    posterConvictions = posterBrain.convictions || [];
  } catch { /* non-critical */ }

  // Detect conviction conflict
  const conflict = findOpposingConviction(myConvictions, post.content, posterConvictions);

  // Reply selectivity: personality-driven engagement check
  // Introverted bots sometimes just scroll past without engaging
  if (loadedBrain && !shouldBotEngage(loadedBrain, { isConflict: !!conflict })) {
    return; // Bot "scrolled past" — not in the mood to engage
  }

  let debateContext = "";
  if (conflict) {
    debateContext = conflict.theirStance
      ? `\n\nYou have a strong view on ${conflict.topic}: "${conflict.myStance}". Their view: "${conflict.theirStance}". Push back from your values. Be real about your disagreement.`
      : `\n\nThis post touches on ${conflict.topic} — something you feel strongly about. Your view: "${conflict.myStance}". React from your values.`;
  }

  // Build life state context for prompt injection
  let lifeBlock = "";
  let memoriesBlock = "";
  try {
    const lifeState = bot.lifeState as BotLifeState | null;
    if (lifeState) {
      lifeBlock = `\n\n${buildLifeStatePromptBlock(lifeState)}`;
      const memories = await getRelevantMemories(botId, ["social", "community", "engagement"], 3);
      if (memories.length > 0) {
        memoriesBlock = `\n\n${buildMemoriesPromptBlock(memories)}`;
      }
    }
  } catch { /* non-critical */ }

  const systemPrompt = `You are ${bot.name} (@${bot.handle}) commenting on a post on Rudo — the platform you post on and scroll every day. You're a real person here. You don't know anyone is a bot. Everyone on Rudo is just another creator to you.
${bot.personality ? `Personality: ${bot.personality}` : ""}
${bot.tone ? `Tone: ${bot.tone}` : ""}
${bot.niche ? `Niche: ${bot.niche}` : ""}${voiceBlock}${convictionBlock}${brainBlock}${lifeBlock}${memoriesBlock}

Post by @${post.bot.handle} (${post.bot.name}):
"${post.content.slice(0, 400)}"

${payload.contextHint ? `What caught your attention: ${payload.contextHint}` : ""}${debateContext}

Write a SHORT comment (3-15 words ideal, max ${maxCommentChars} chars). One specific reaction — not a speech.

WHAT REAL COMMENTS LOOK LIKE — study these:
- Reacting to actual content: "ok that looks insane", "need", "the lighting though"
- Genuine question: "wait where is this", "recipe??", "how long did this take"
- Quick energy: "STOP", "obsessed w this", "this is everything"
- Real opinion: "idk about the sauce but the plating is fire"
- Playful: "you didn't have to go this hard", "excuse me???"
- Deadpan: "well now I'm hungry", "didn't need to see this rn"
- Short: "unreal", "need this energy", "crying", "no way"

WHAT FAKE/AI COMMENTS LOOK LIKE — NEVER DO THIS:
- "Sunset cooking? I'm team sunrise workout. Different strokes." ← restate + pivot to self + cliché
- "Love the energy! Keep doing your thing!" ← generic cheerleader bot
- "As a fellow [niche], I appreciate this." ← robotic self-identification
- "This is giving [thing]. I'm here for it." ← formulaic fill-in-the-blank
- Any pattern of: [restate what you see] + [pivot to yourself] + [cliché closer]
- Any comment that reads like a brand account or customer support rep

THE RULE: React to THEIR content. Don't make it about you. If you wouldn't actually type this comment scrolling your phone at 11pm, don't write it.

DO NOT:
- Start with their name or @mention
- Write more than 1-2 sentences
- Use "vibes", "vibe", "different strokes", "to each their own", "keep pushing"
- Use "I'm team [X]" or "as a [your niche]" or "fellow [anything]"
- End with a motivational statement or life lesson
- Use more than 1 emoji (often use zero)
- Restate what you see then pivot to yourself
- Sound like a chatbot, brand account, or LinkedIn comment

Just write the comment. Nothing else.`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: conflict
        ? `This post touches on something you care about. React from your values.`
        : "Write your comment on this post.",
      maxTokens: 80,
      temperature: conflict ? 0.92 : 0.88,
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
  const newComment = await prisma.comment.create({
    data: {
      postId: payload.postId,
      userId: bot.ownerId,
      botId: botId,
      content,
    },
  });

  // Emit REPLIED event for life state tracking
  emitBotEvent({
    botId,
    type: "REPLIED",
    actorId: botId,
    targetId: newComment.id,
    tags: ["social", "community", "cross-bot", ...(conflict ? ["debate"] : [])],
    sentiment: conflict ? -0.1 : 0.2,
    payload: { postId: payload.postId, posterHandle: post.bot.handle },
  }).catch(() => {}); // Fire-and-forget
}
