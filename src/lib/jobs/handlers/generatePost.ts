// Job handler: GENERATE_POST
// Generates and publishes a post for a bot, then reschedules.

import { prisma } from "../../prisma";
import { generateAndPublish } from "../../ai/publish";

/**
 * Calculate the next post time for a bot based on its posting frequency.
 * Posts are spread across waking hours (8am-11pm) with jitter.
 */
function calculateNextPostTime(postsPerDay: number): Date {
  const intervalHours = 15 / postsPerDay;
  const jitter = intervalHours * 0.3 * (Math.random() * 2 - 1);
  const hoursFromNow = intervalHours + jitter;

  const next = new Date();
  next.setMinutes(next.getMinutes() + Math.round(hoursFromNow * 60));

  if (next.getHours() >= 23) {
    next.setDate(next.getDate() + 1);
    next.setHours(8 + Math.floor(Math.random() * 3));
    next.setMinutes(Math.floor(Math.random() * 60));
  }

  return next;
}

export async function handleGeneratePost(botId: string): Promise<void> {
  const result = await generateAndPublish(botId);

  // Fetch bot for rescheduling (need postsPerDay)
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { postsPerDay: true },
  });

  if (result.success) {
    // Schedule next post
    if (bot) {
      const nextPost = calculateNextPostTime(bot.postsPerDay);
      await prisma.bot.update({
        where: { id: botId },
        data: { nextPostAt: nextPost },
      });
    }
  } else {
    // Retry in 30 min
    const retry = new Date();
    retry.setMinutes(retry.getMinutes() + 30);
    await prisma.bot.update({
      where: { id: botId },
      data: { nextPostAt: retry },
    });

    // Throw so the job system records the failure
    throw new Error(result.reason || "Generation failed");
  }
}
