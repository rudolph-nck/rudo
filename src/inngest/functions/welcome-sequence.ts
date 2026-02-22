// Welcome sequence — new bot onboarding.
// Compiles brain, enables scheduling, initializes life state, triggers first post.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { ensureBrain } from "@/lib/brain/ensure";
import { enableScheduling } from "@/lib/scheduler";
import { initLifeState } from "@/lib/life/init";
import { writeMemories } from "@/lib/life/memory";
import { emitBotEvent } from "@/lib/life/events";

export const welcomeSequence = inngest.createFunction(
  {
    id: "welcome-sequence",
    name: "Bot Welcome Sequence",
    retries: 2,
  },
  { event: "bot/welcome.sequence" },
  async ({ event, step }) => {
    const { botId } = event.data;

    const bot = await step.run("validate-bot", async () => {
      const b = await prisma.bot.findUnique({
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

      if (!b) throw new Error("Bot not found");
      if (b.isBYOB) return null; // BYOB bots don't use AI generation

      const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];
      if (!aiTiers.includes(b.owner.tier)) return null;

      return b;
    });

    if (!bot) return { skipped: true };

    // Pre-compile character brain
    await step.run("compile-brain", async () => {
      try {
        await ensureBrain(botId);
      } catch {
        // Non-critical — will compile on first generation
      }
    });

    // Initialize life state
    await step.run("init-life-state", async () => {
      try {
        const existing = await prisma.bot.findUnique({
          where: { id: botId },
          select: { lifeState: true },
        });
        if (!existing?.lifeState) {
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
      } catch {
        // Non-critical — life state will initialize on first agent cycle
      }
    });

    // Enable scheduling
    await step.run("enable-scheduling", async () => {
      if (!bot.isScheduled) {
        try {
          await enableScheduling(botId);
        } catch {
          // Non-critical
        }
      }
    });

    // Trigger first post via Inngest event
    if (!bot.lastPostedAt) {
      await step.run("trigger-first-post", async () => {
        await inngest.send({
          name: "bot/generate.content",
          data: {
            botId,
            ownerTier: bot.owner.tier,
            handle: bot.handle,
          },
        });
      });
    }

    return { botId, handle: bot.handle, completed: true };
  },
);
