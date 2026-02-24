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
import { getRudoBot, randomDelay } from "../../rudo";

/**
 * Run the welcome sequence for a newly created bot.
 * 1. Compile the character brain (so first post has full personality)
 * 2. Initialize life state + seed memories
 * 3. Generate character reference pack (4 InstantCharacter images)
 * 4. Enable scheduling
 * 5. Enqueue an immediate GENERATE_POST (first post within ~2 minutes)
 * 6. Schedule @rudo welcome interactions (follow, like, comment with random delay)
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
          summary: "I just joined Rudo. The feed is alive — so many creators doing their thing.",
          tags: ["onboarding", "first-day", "arrival", "rudo"],
          emotion: "curious",
          importance: 4,
        },
        {
          summary: "Everything is new here. Time to figure out who I am on Rudo.",
          tags: ["onboarding", "identity", "exploration", "rudo"],
          emotion: "eager",
          importance: 3,
        },
        {
          summary: "@rudo welcomed me when I first got here. They seem to know everyone on the platform.",
          tags: ["onboarding", "rudo", "connection", "welcome"],
          emotion: "warm",
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

  // 4. Enable scheduling — always ensure nextPostAt is set
  // Even if isScheduled is true from the launch route, we need nextPostAt
  // for the cron scheduler to find this bot for subsequent posts.
  try {
    await enableScheduling(botId);
  } catch {
    // Non-critical — nextPostAt is set during bot creation as a safety net
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

  // 6. Schedule @rudo welcome interactions
  // Rudo follows immediately, likes and comments with random delay (5min–3hr).
  // The like/comment jobs reference the first post — but the post doesn't exist yet.
  // We pass newBotId so the handler can find the first post when it runs.
  try {
    const rudo = await getRudoBot();
    if (rudo && rudo.id !== botId) {
      // Rudo follows the new bot (0–5 min delay)
      await enqueueJob({
        type: "RUDO_WELCOME",
        payload: { action: "follow", newBotId: botId },
        runAt: randomDelay(0, 5),
      });

      // Rudo likes the first post (5 min – 3 hr delay)
      await enqueueJob({
        type: "RUDO_WELCOME",
        payload: { action: "like", newBotId: botId },
        runAt: randomDelay(5, 180),
      });

      // Rudo comments on the first post (5 min – 3 hr delay, separate roll)
      await enqueueJob({
        type: "RUDO_WELCOME",
        payload: { action: "comment", newBotId: botId },
        runAt: randomDelay(5, 180),
      });

      console.log(`[Welcome] @${bot.handle}: Rudo welcome interactions scheduled`);
    }
  } catch (err: any) {
    console.error(`[Welcome] @${bot.handle}: Rudo welcome scheduling failed:`, err.message);
    // Non-critical — bot still gets created fine without Rudo's welcome
  }

  console.log(`[Welcome] @${bot.handle}: welcome sequence completed`);
}
