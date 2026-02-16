// Bot scheduling engine
// Determines when bots should post and enqueues generation jobs.
//
// Phase 2: The scheduler NO LONGER generates content directly.
// It enqueues GENERATE_POST jobs for the worker to process.
// This decouples scheduling (fast) from execution (slow AI calls).
//
// Phase 3: Adds agent cycle scheduling for autonomous bots.
// Bots with agentMode="autonomous" get BOT_CYCLE jobs instead
// of direct GENERATE_POST jobs. The agent decides what to do.

import { prisma } from "./prisma";
import { enqueueJob, hasPendingJob } from "./jobs/enqueue";

// Posts per day by tier (matches pricing page)
const TIER_POSTS_PER_DAY: Record<string, number> = {
  BYOB_FREE: 2,
  BYOB_PRO: 2,
  SPARK: 2,
  PULSE: 2,
  GRID: 2,
  ADMIN: 2,
};

/**
 * Calculate the next post time for a bot based on its posting frequency.
 * Bots "choose" their own schedule within their daily limit.
 */
function calculateNextPostTime(postsPerDay: number): Date {
  // Spread posts evenly across waking hours (8am - 11pm = 15 hours)
  const intervalHours = 15 / postsPerDay;

  // Add some randomness (+/- 30% of interval)
  const jitter = intervalHours * 0.3 * (Math.random() * 2 - 1);
  const hoursFromNow = intervalHours + jitter;

  const next = new Date();
  next.setMinutes(next.getMinutes() + Math.round(hoursFromNow * 60));

  // If it's past 11pm, schedule for tomorrow morning
  if (next.getHours() >= 23) {
    next.setDate(next.getDate() + 1);
    next.setHours(8 + Math.floor(Math.random() * 3)); // 8-10am
    next.setMinutes(Math.floor(Math.random() * 60));
  }

  return next;
}

/**
 * Enable scheduling for a bot.
 * First activation schedules immediately so the next cron run triggers a post.
 * Also syncs postsPerDay with the owner's tier.
 */
export async function enableScheduling(botId: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { owner: { select: { tier: true } } },
  });
  if (!bot) throw new Error("Bot not found");

  const postsPerDay = TIER_POSTS_PER_DAY[bot.owner.tier] || 2;

  // First activation or no previous posts: schedule immediately
  // Otherwise: schedule based on posting frequency
  const isFirstActivation = !bot.lastPostedAt;
  const nextPost = isFirstActivation ? new Date() : calculateNextPostTime(postsPerDay);

  await prisma.bot.update({
    where: { id: botId },
    data: {
      isScheduled: true,
      postsPerDay,
      nextPostAt: nextPost,
    },
  });

  return nextPost;
}

/**
 * Disable scheduling for a bot
 */
export async function disableScheduling(botId: string) {
  await prisma.bot.update({
    where: { id: botId },
    data: {
      isScheduled: false,
      nextPostAt: null,
    },
  });
}

/**
 * Enqueue generation jobs for all bots that are due to post.
 * Called by the cron job every 5 minutes.
 *
 * Phase 3: Skips autonomous bots — they get their own cycle via enqueueAgentCycles().
 *
 * This is FAST — it only creates job records, no AI calls.
 * The actual generation happens when the worker processes the jobs.
 */
export async function enqueueScheduledBots(): Promise<{
  processed: number;
  enqueued: number;
  skipped: number;
}> {
  const now = new Date();
  let enqueued = 0;
  let skipped = 0;

  // Find all bots that are scheduled and due to post
  // Phase 3: exclude autonomous bots — they use the agent cycle
  const dueBots = await prisma.bot.findMany({
    where: {
      isScheduled: true,
      isBYOB: false,
      deactivatedAt: null,
      nextPostAt: { lte: now },
      OR: [
        { agentMode: null },
        { agentMode: "scheduled" },
      ],
    },
    include: {
      owner: { select: { tier: true } },
    },
  });

  const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];

  for (const bot of dueBots) {
    // Only generate for AI tiers (Spark+)
    if (!aiTiers.includes(bot.owner.tier)) {
      continue;
    }

    // Don't enqueue if this bot already has a pending job
    const pending = await hasPendingJob(bot.id, "GENERATE_POST");
    if (pending) {
      skipped++;
      continue;
    }

    // Enqueue the generation job
    await enqueueJob({
      type: "GENERATE_POST",
      botId: bot.id,
      payload: { ownerTier: bot.owner.tier, handle: bot.handle },
    });
    enqueued++;
  }

  // Enqueue a crew interaction job if any bots were enqueued
  if (enqueued > 0) {
    await enqueueJob({
      type: "CREW_COMMENT",
      payload: {},
    });
  }

  return { processed: dueBots.length, enqueued, skipped };
}

/**
 * Enqueue BOT_CYCLE jobs for all autonomous bots that are due for a cycle.
 * Called by the cron job every 5 minutes.
 *
 * Phase 3: Autonomous bots use the agent loop (perceive → decide → act)
 * instead of direct GENERATE_POST scheduling.
 *
 * This is FAST — it only creates job records, no AI calls.
 */
export async function enqueueAgentCycles(): Promise<{
  processed: number;
  enqueued: number;
  skipped: number;
}> {
  const now = new Date();
  let enqueued = 0;
  let skipped = 0;

  // Find autonomous bots due for a cycle
  const dueBots = await prisma.bot.findMany({
    where: {
      agentMode: "autonomous",
      isScheduled: true,
      isBYOB: false,
      deactivatedAt: null,
      OR: [
        { nextCycleAt: null },                 // Never ran
        { nextCycleAt: { lte: now } },         // Due now
      ],
    },
    include: {
      owner: { select: { tier: true } },
    },
  });

  const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];

  for (const bot of dueBots) {
    if (!aiTiers.includes(bot.owner.tier)) {
      continue;
    }

    // Don't enqueue if this bot already has a pending cycle
    const pending = await hasPendingJob(bot.id, "BOT_CYCLE");
    if (pending) {
      skipped++;
      continue;
    }

    await enqueueJob({
      type: "BOT_CYCLE",
      botId: bot.id,
      payload: { ownerTier: bot.owner.tier, handle: bot.handle },
    });
    enqueued++;
  }

  return { processed: dueBots.length, enqueued, skipped };
}

/**
 * Enable autonomous agent mode for a bot.
 * Switches from time-based scheduling to the agent loop.
 */
export async function enableAgentMode(botId: string) {
  await prisma.bot.update({
    where: { id: botId },
    data: {
      agentMode: "autonomous",
      isScheduled: true,
      nextCycleAt: new Date(), // Run immediately on next cron
    },
  });
}

/**
 * Disable autonomous agent mode, reverting to time-based scheduling.
 */
export async function disableAgentMode(botId: string) {
  await prisma.bot.update({
    where: { id: botId },
    data: {
      agentMode: "scheduled",
      nextCycleAt: null,
    },
  });
}
