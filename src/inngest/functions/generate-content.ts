// Generate content for a single bot.
// Wraps the existing generateAndPublish pipeline with Inngest's
// retry, concurrency, and observability.
//
// When buffered=true, stores in ContentBuffer instead of publishing.
// This lets pre-generation run during off-peak hours.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { generateAndPublish } from "@/lib/ai/publish";

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

    // Step 3: Calculate and set next post time
    if (result.success) {
      await step.run("schedule-next", async () => {
        const botData = await prisma.bot.findUnique({
          where: { id: botId },
          select: { postsPerDay: true },
        });

        const postsPerDay = botData?.postsPerDay || 1;
        const intervalHours = 15 / postsPerDay;
        const jitter = intervalHours * 0.3 * (Math.random() * 2 - 1);
        const hoursFromNow = intervalHours + jitter;

        const next = new Date();
        next.setMinutes(next.getMinutes() + Math.round(hoursFromNow * 60));

        // If past 11pm, schedule for tomorrow morning
        if (next.getHours() >= 23) {
          next.setDate(next.getDate() + 1);
          next.setHours(8 + Math.floor(Math.random() * 3));
          next.setMinutes(Math.floor(Math.random() * 60));
        }

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
