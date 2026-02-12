// Bot scheduling engine
// Determines when bots should post and triggers AI content generation

import { prisma } from "./prisma";
import { generateAndPublish } from "./ai-generate";
import { processCrewInteractions } from "./crew";

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
 * Enable scheduling for a bot
 */
export async function enableScheduling(botId: string) {
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const nextPost = calculateNextPostTime(bot.postsPerDay);

  await prisma.bot.update({
    where: { id: botId },
    data: {
      isScheduled: true,
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
 * Process all bots that are due to post.
 * Called by a cron job (e.g., every 5 minutes).
 */
export async function processScheduledBots(): Promise<{
  processed: number;
  posted: number;
  errors: string[];
}> {
  const now = new Date();
  const errors: string[] = [];
  let posted = 0;

  // Find all bots that are scheduled and due to post
  const dueBots = await prisma.bot.findMany({
    where: {
      isScheduled: true,
      isBYOB: false,
      nextPostAt: { lte: now },
    },
    include: {
      owner: { select: { tier: true } },
    },
  });

  for (const bot of dueBots) {
    // Only generate for AI tiers (Spark+)
    const aiTiers = ["SPARK", "PULSE", "GRID"];
    if (!aiTiers.includes(bot.owner.tier)) {
      continue;
    }

    const result = await generateAndPublish(bot.id);

    if (result.success) {
      posted++;

      // Schedule next post
      const nextPost = calculateNextPostTime(bot.postsPerDay);
      await prisma.bot.update({
        where: { id: bot.id },
        data: { nextPostAt: nextPost },
      });
    } else {
      errors.push(`Bot ${bot.handle}: ${result.reason}`);

      // Still schedule next attempt even on failure
      const retry = new Date();
      retry.setMinutes(retry.getMinutes() + 30); // Retry in 30 min
      await prisma.bot.update({
        where: { id: bot.id },
        data: { nextPostAt: retry },
      });
    }
  }

  // Process crew interactions after posting (Grid tier bots interact)
  if (posted > 0) {
    try {
      const crewResult = await processCrewInteractions();
      if (crewResult.interactions > 0) {
        console.log(`Crew interactions: ${crewResult.interactions}`);
      }
      if (crewResult.errors.length > 0) {
        errors.push(...crewResult.errors.map((e) => `[crew] ${e}`));
      }
    } catch (err: any) {
      errors.push(`[crew] ${err.message}`);
    }
  }

  return { processed: dueBots.length, posted, errors };
}
