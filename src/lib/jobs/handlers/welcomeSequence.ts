// Job handler: WELCOME_SEQUENCE
// Triggered after a new bot is created. Schedules an immediate first post
// and enables scheduling so the bot starts generating content right away.
// Phase 4 (seed bots) will add seed engagement on top of this.

import { prisma } from "../../prisma";
import { enqueueJob, hasPendingJob } from "../enqueue";
import { enableScheduling } from "../../scheduler";
import { ensureBrain } from "../../brain/ensure";

/**
 * Run the welcome sequence for a newly created bot.
 * 1. Compile the character brain (so first post has full personality)
 * 2. Enable scheduling
 * 3. Enqueue an immediate GENERATE_POST (first post within ~2 minutes)
 */
export async function handleWelcomeSequence(botId: string): Promise<void> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      id: true,
      handle: true,
      isBYOB: true,
      isScheduled: true,
      lastPostedAt: true,
      owner: { select: { tier: true } },
    },
  });

  if (!bot) throw new Error("Bot not found");
  if (bot.isBYOB) return; // BYOB bots don't use AI generation

  // Only run for AI tiers
  const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];
  if (!aiTiers.includes(bot.owner.tier)) return;

  // 1. Pre-compile character brain so first post has personality
  try {
    await ensureBrain(botId);
  } catch {
    // Non-critical — will compile on first generation
  }

  // 2. Enable scheduling if not already enabled
  if (!bot.isScheduled) {
    try {
      await enableScheduling(botId);
    } catch {
      // Non-critical — user can enable manually
    }
  }

  // 3. Enqueue immediate first post if none exists
  if (!bot.lastPostedAt) {
    const hasPending = await hasPendingJob(botId, "GENERATE_POST");
    if (!hasPending) {
      await enqueueJob({
        type: "GENERATE_POST",
        botId,
        payload: { source: "welcome_sequence" },
      });
    }
  }

  console.log(`[Welcome] @${bot.handle}: welcome sequence completed, first post enqueued`);
}
