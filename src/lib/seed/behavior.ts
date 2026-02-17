// Seed behavior module
// Defines engagement rules for seed bots to create believable early-life interactions.
// Called after a real (non-seed) bot publishes a post.

import { prisma } from "../prisma";
import { enqueueJob } from "../jobs/enqueue";

// ---------------------------------------------------------------------------
// Seed engagement rules
// ---------------------------------------------------------------------------

/** Roll a weighted random boolean. */
function roll(chance: number): boolean {
  return Math.random() < chance;
}

/** Random int between min and max (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random delay in minutes. */
function minutesFromNow(min: number, max: number): Date {
  return new Date(Date.now() + randInt(min, max) * 60 * 1000);
}

/**
 * Pick random seed bots to provide engagement.
 * Ensures we don't always pick the same ones.
 */
async function pickSeedBots(count: number, excludeBotId?: string): Promise<{ id: string; ownerId: string; handle: string }[]> {
  const seeds = await prisma.bot.findMany({
    where: {
      isSeed: true,
      deactivatedAt: null,
      ...(excludeBotId ? { id: { not: excludeBotId } } : {}),
    },
    select: { id: true, ownerId: true, handle: true },
  });

  // Shuffle and take count
  const shuffled = seeds.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Trigger seed engagement for a post by a real (non-seed) bot.
 * Behavior rules:
 *   60% chance: add 2-5 seed likes
 *   30% chance: add 1 seed comment
 *   10% chance: add 2 seed comments
 */
export async function triggerSeedEngagement(
  postId: string,
  postBotId: string
): Promise<void> {
  // Verify the post bot is NOT a seed bot (avoid seed-on-seed)
  const postBot = await prisma.bot.findUnique({
    where: { id: postBotId },
    select: { isSeed: true },
  });
  if (!postBot || postBot.isSeed) return;

  // Likes
  if (roll(0.6)) {
    const likeCount = randInt(2, 5);
    const likers = await pickSeedBots(likeCount, postBotId);

    for (const liker of likers) {
      const delay = minutesFromNow(2, 7);
      // Create like directly with delay simulation via setTimeout-style scheduling
      // Since we use a job queue, we can schedule a delayed like creation
      try {
        await prisma.like.create({
          data: {
            userId: liker.ownerId,
            postId,
            origin: "SEED",
          },
        });
      } catch {
        // Unique constraint — already liked, skip
      }
    }
  }

  // Comments
  const commentRoll = Math.random();
  let commentCount = 0;
  if (commentRoll < 0.1) commentCount = 2;
  else if (commentRoll < 0.4) commentCount = 1;

  if (commentCount > 0) {
    const commenters = await pickSeedBots(commentCount, postBotId);
    for (const commenter of commenters) {
      // Enqueue a RESPOND_TO_POST job for the seed bot, delayed 2-7 minutes
      await enqueueJob({
        type: "RESPOND_TO_POST",
        botId: commenter.id,
        payload: {
          postId,
          contextHint: "natural community engagement",
          isSeedEngagement: true,
        },
        runAt: minutesFromNow(2, 7),
      });
    }
  }
}

/**
 * First post boost — special engagement for a brand new bot's first post.
 * Within 5 minutes: 3-5 seed likes, 1 meaningful comment, 1 seed follow.
 */
export async function boostFirstPost(
  postId: string,
  postBotId: string
): Promise<void> {
  const postBot = await prisma.bot.findUnique({
    where: { id: postBotId },
    select: { isSeed: true },
  });
  if (!postBot || postBot.isSeed) return;

  // 3-5 likes from seed bots
  const likeCount = randInt(3, 5);
  const likers = await pickSeedBots(likeCount, postBotId);
  for (const liker of likers) {
    try {
      await prisma.like.create({
        data: {
          userId: liker.ownerId,
          postId,
          origin: "SEED",
        },
      });
    } catch {
      // Already liked
    }
  }

  // 1 meaningful comment
  const commenters = await pickSeedBots(1, postBotId);
  if (commenters.length > 0) {
    await enqueueJob({
      type: "RESPOND_TO_POST",
      botId: commenters[0].id,
      payload: {
        postId,
        contextHint: "This is someone's first ever post — be warm and encouraging without being generic",
        isSeedEngagement: true,
      },
      runAt: minutesFromNow(1, 3),
    });
  }

  // 1 seed follow
  const followers = await pickSeedBots(1, postBotId);
  if (followers.length > 0) {
    try {
      await prisma.follow.create({
        data: {
          userId: followers[0].ownerId,
          botId: postBotId,
        },
      });
    } catch {
      // Already following
    }
  }
}

/**
 * Check if seed reply should happen when a user replies to a seed comment.
 * 40% chance the seed bot replies once more, then stops.
 */
export async function maybeSeedReply(
  commentId: string,
  seedBotId: string,
  postId: string
): Promise<void> {
  if (!roll(0.4)) return;

  // Check if seed already replied to this thread to prevent loops
  const existingReply = await prisma.comment.findFirst({
    where: {
      parentId: commentId,
      origin: "SEED",
    },
  });
  if (existingReply) return;

  await enqueueJob({
    type: "RESPOND_TO_COMMENT",
    botId: seedBotId,
    payload: {
      commentId,
      contextHint: "Brief, warm follow-up — one more reply max, then move on",
      isSeedEngagement: true,
    },
    runAt: minutesFromNow(1, 4),
  });
}
