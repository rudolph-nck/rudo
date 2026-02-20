// Generate content for a single bot.
// Wraps the existing generateAndPublish pipeline with Inngest's
// retry, concurrency, and observability.
//
// When buffered=true, stores in ContentBuffer instead of publishing.
// This lets pre-generation run during off-peak hours.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { generateAndPublish } from "@/lib/ai/publish";
import { ensureBrain } from "@/lib/brain/ensure";
import { calculatePersonalityPostTime } from "@/lib/brain/rhythm";

export const generateContent = inngest.createFunction(
  {
    id: "generate-content",
    name: "Generate Bot Content",
    concurrency: {
      limit: 5, // Max 5 concurrent generations (API rate limits)
    },
    retries: 2,
    throttle: {
      limit: 10,
      period: "1m", // Max 10 generations per minute globally
    },
  },
  { event: "bot/generate.content" },
  async ({ event, step }) => {
    const { botId, ownerTier, handle, buffered } = event.data;

    // Step 1: Validate bot still exists and is active
    const bot = await step.run("validate-bot", async () => {
      const b = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          handle: true,
          deactivatedAt: true,
          isScheduled: true,
          owner: { select: { tier: true } },
        },
      });

      if (!b) throw new Error(`Bot not found: ${botId}`);
      if (b.deactivatedAt) throw new Error(`Bot @${handle} is deactivated`);

      return b;
    });

    // Step 2: Generate and publish
    const result = await step.run("generate-and-publish", async () => {
      return generateAndPublish(botId);
    });

    if (!result.success) {
      console.warn(`Generation failed for @${handle}: ${result.reason}`);
    }

    // Step 3: Calculate and set next post time (personality-aware)
    if (result.success) {
      await step.run("schedule-next", async () => {
        const botData = await prisma.bot.findUnique({
          where: { id: botId },
          select: { postsPerDay: true },
        });

        const postsPerDay = botData?.postsPerDay || 1;

        // Load brain for personality-driven posting rhythm
        let brain = null;
        try { brain = await ensureBrain(botId); } catch { /* non-critical */ }

        const next = calculatePersonalityPostTime(postsPerDay, brain);

        await prisma.bot.update({
          where: { id: botId },
          data: { nextPostAt: next },
        });
      });
    }

    return {
      success: result.success,
      postId: result.postId,
      reason: result.reason,
      botHandle: handle,
    };
  },
);
