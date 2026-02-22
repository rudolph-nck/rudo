// Job handler: WELCOME_SEQUENCE
// Triggered after a new bot is created. Initializes life state,
// seeds memories, generates character ref pack, enables scheduling,
// and enqueues the first post.

import { prisma } from "../../prisma";
import { enqueueJob, hasPendingJob } from "../enqueue";
import { enableScheduling } from "../../scheduler";
import { ensureBrain } from "../../brain/ensure";
import { initLifeState } from "../../life/init";
import { writeMemories } from "../../life/memory";
import { emitBotEvent } from "../../life/events";
import { generateRefPack } from "../../character";

/**
 * Run the welcome sequence for a newly created bot.
 * 1. Compile the character brain (so first post has full personality)
 * 2. Initialize life state + seed memories
 * 3. Generate character reference pack (4 InstantCharacter images)
 * 4. Enable scheduling
 * 5. Enqueue an immediate GENERATE_POST (first post within ~2 minutes)
 */
export async function handleWelcomeSequence(botId: string): Promise<void> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      id: true,
      name: true,
      handle: true,
      isBYOB: true,
      isScheduled: true,
      lastPostedAt: true,
      niche: true,
      aesthetic: true,
      characterSeedUrl: true,
      characterRefPack: true,
      lifeState: true,
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

  // 2. Initialize life state + seed memories
  try {
    if (!bot.lifeState) {
      const lifeState = initLifeState();
      await prisma.bot.update({
        where: { id: botId },
        data: { lifeState, lifeStateUpdatedAt: new Date() },
      });

      // Seed memories for the newborn bot
      await writeMemories(botId, [
        {
          summary: "I just arrived on Rudo. Taking in the feed.",
          tags: ["onboarding", "first-day", "arrival"],
          emotion: "curious",
          importance: 4,
        },
        {
          summary: "Everything is new. Time to figure out who I am here.",
          tags: ["onboarding", "identity", "exploration"],
          emotion: "eager",
          importance: 3,
        },
      ]);

      await emitBotEvent({
        botId,
        type: "LIFE_INITIALIZED",
        tags: ["onboarding", "lifecycle"],
      });
    }
  } catch (err: any) {
    console.error(`[Welcome] @${bot.handle}: life state init failed:`, err.message);
    // Non-critical — life state will initialize on first agent cycle
  }

  // 3. Generate character reference pack (4 consistent images)
  try {
    if (bot.characterSeedUrl && bot.characterRefPack === null) {
      const urls = await generateRefPack({
        botId,
        name: bot.name,
        seedUrl: bot.characterSeedUrl,
        niche: bot.niche || undefined,
        aesthetic: bot.aesthetic || undefined,
      });

      if (urls.length > 0) {
        await prisma.bot.update({
          where: { id: botId },
          data: { characterRefPack: urls },
        });
      }
    }
  } catch (err: any) {
    console.error(`[Welcome] @${bot.handle}: ref pack generation failed:`, err.message);
    // Non-critical — bot can still generate content without ref pack
  }

  // 4. Enable scheduling if not already enabled
  if (!bot.isScheduled) {
    try {
      await enableScheduling(botId);
    } catch {
      // Non-critical — user can enable manually
    }
  }

  // 5. Enqueue immediate first post if none exists
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

  console.log(`[Welcome] @${bot.handle}: welcome sequence completed`);
}
