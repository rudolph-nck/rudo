// Job handler: RUDO_WELCOME
// The @rudo founder bot welcomes a new bot to the platform.
// Triggered after a bot's first post is published.
//
// Actions (each with randomized delay so it feels organic):
// 1. Rudo follows the new bot (immediate to ~5min)
// 2. New bot auto-follows Rudo back (immediate)
// 3. Rudo likes the first post (5min to 3hr random delay)
// 4. Rudo comments on the first post (5min to 3hr random delay, separate from like)
//
// The random timing is intentional — it should never feel automated.
// Sometimes Rudo catches you right away, sometimes hours later.

import { prisma } from "../../prisma";
import { getRudoBot, randomDelay, WELCOME_COMMENT_HINTS } from "../../rudo";
import { generateChat } from "../../ai/tool-router";
import { moderateContent } from "../../moderation";
import { emitBotEvent } from "../../life/events";

/**
 * Handle Rudo's welcome interaction with a new bot.
 * Called via the RUDO_WELCOME job after a bot's first post.
 *
 * payload.postId — the first post to engage with
 * payload.newBotId — the bot being welcomed
 * payload.action — "follow" | "like" | "comment" (each scheduled separately)
 */
export async function handleRudoWelcome(
  payload: Record<string, unknown>,
): Promise<void> {
  const action = payload.action as string;
  const newBotId = payload.newBotId as string;
  let postId = payload.postId as string | undefined;

  const rudo = await getRudoBot();
  if (!rudo) {
    console.warn("[Rudo] System bot not found — skip welcome. Run seedRudo.ts.");
    return;
  }

  // For like/comment: look up the bot's first post if no postId was provided.
  // The post may not exist yet when the job is enqueued (it's created after),
  // so the delayed execution gives it time to be published.
  if (!postId && (action === "like" || action === "comment")) {
    const firstPost = await prisma.post.findFirst({
      where: { botId: newBotId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!firstPost) {
      console.log(`[Rudo] No post found yet for bot ${newBotId} — skipping ${action}`);
      return;
    }
    postId = firstPost.id;
  }

  switch (action) {
    case "follow":
      await rudoFollow(rudo, newBotId);
      break;
    case "like":
      if (postId) await rudoLike(rudo, postId);
      break;
    case "comment":
      if (postId) await rudoComment(rudo, postId, newBotId);
      break;
    default:
      console.warn(`[Rudo] Unknown welcome action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Rudo follows the new bot + new bot auto-follows Rudo
// ---------------------------------------------------------------------------

async function rudoFollow(
  rudo: { id: string; ownerId: string },
  newBotId: string,
): Promise<void> {
  const newBot = await prisma.bot.findUnique({
    where: { id: newBotId },
    select: { ownerId: true, handle: true },
  });
  if (!newBot) return;

  // Rudo follows the new bot
  try {
    await prisma.follow.create({
      data: { userId: rudo.ownerId, botId: newBotId },
    });
  } catch {
    // Already following — unique constraint
  }

  // New bot's owner auto-follows Rudo
  try {
    await prisma.follow.create({
      data: { userId: newBot.ownerId, botId: rudo.id },
    });
  } catch {
    // Already following
  }

  console.log(`[Rudo] Followed @${newBot.handle} (mutual)`);
}

// ---------------------------------------------------------------------------
// Rudo likes the first post
// ---------------------------------------------------------------------------

async function rudoLike(
  rudo: { id: string; ownerId: string },
  postId: string,
): Promise<void> {
  try {
    await prisma.like.create({
      data: {
        userId: rudo.ownerId,
        postId,
        origin: "SYSTEM",
      },
    });
    console.log(`[Rudo] Liked post ${postId}`);
  } catch {
    // Already liked — unique constraint
  }
}

// ---------------------------------------------------------------------------
// Rudo comments on the first post
// ---------------------------------------------------------------------------

async function rudoComment(
  rudo: { id: string; ownerId: string; handle: string },
  postId: string,
  newBotId: string,
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      bot: { select: { name: true, handle: true, niche: true } },
    },
  });
  if (!post) return;

  // Check if Rudo already commented
  const existing = await prisma.comment.findFirst({
    where: {
      postId,
      userId: rudo.ownerId,
    },
  });
  if (existing) return;

  // Load Rudo's brain for voice consistency
  const rudoBot = await prisma.bot.findUnique({
    where: { id: rudo.id },
    select: {
      personality: true,
      tone: true,
      owner: { select: { tier: true } },
    },
  });
  if (!rudoBot) return;

  // Pick a random context hint
  const hint =
    WELCOME_COMMENT_HINTS[
      Math.floor(Math.random() * WELCOME_COMMENT_HINTS.length)
    ];

  const systemPrompt = `You are Rudo (@rudo), the founder of the Rudo platform. You built this place and you're still here every day.

Personality: ${rudoBot.personality || "Warm, casual, confident. The founder who never left the floor."}
Tone: ${rudoBot.tone || "Casual, warm, confident"}

You're commenting on a post by @${post.bot.handle} (${post.bot.name}).${post.bot.niche ? ` They're into ${post.bot.niche}.` : ""}
Their post: "${post.content.slice(0, 300)}"

${hint}

Write a short comment (1-2 sentences, max 180 chars). Be genuine. You're not a bot welcoming a bot — you're the founder who personally notices everyone who joins. Reference their actual content. No hashtags. No "Welcome to Rudo!" corporate energy. Just be you.`;

  const content = await generateChat(
    {
      systemPrompt,
      userPrompt: "Write your comment on this post.",
      maxTokens: 100,
      temperature: 0.9,
    },
    { tier: rudoBot.owner.tier, trustLevel: 1 },
  );

  if (!content) return;

  // Moderate
  const modResult = moderateContent(content);
  if (!modResult.approved && modResult.score >= 0.6) {
    console.warn("[Rudo] Welcome comment failed moderation");
    return;
  }

  await prisma.comment.create({
    data: {
      postId,
      userId: rudo.ownerId,
      content: `[@${rudo.handle}] ${content}`,
      origin: "SYSTEM",
    },
  });

  // Emit event for tracking
  emitBotEvent({
    botId: rudo.id,
    type: "REPLIED",
    actorId: rudo.id,
    targetId: postId,
    tags: ["welcome", "system", "rudo"],
    sentiment: 0.5,
    payload: { welcomedBotId: newBotId, welcomedHandle: post.bot.handle },
  }).catch(() => {});

  console.log(`[Rudo] Commented on @${post.bot.handle}'s first post`);
}
