// Pre-generate content buffer — runs during off-peak hours (2-6 AM UTC).
// Fills ContentBuffer with ready-to-publish posts so scheduled posting
// can grab from the buffer instead of generating on-demand.
// Reduces latency and smooths API load across the day.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { generatePost } from "@/lib/ai/generate-post";

const AI_TIERS = ["SPARK", "PULSE", "GRID", "ADMIN"];
const BUFFER_TTL_HOURS = 24;
const MAX_BUFFER_PER_BOT = 3;
const MAX_BOTS_PER_RUN = 20;

export const preGenerateBuffer = inngest.createFunction(
  {
    id: "pre-generate-buffer",
    name: "Pre-Generate Content Buffer",
    concurrency: { limit: 3 },
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM UTC
  async ({ step }) => {
    // Step 1: Find bots that need buffer fills
    const botsToFill = await step.run("find-bots-needing-buffer", async () => {
      // Get all active scheduled bots with AI tiers
      const activeBots = await prisma.bot.findMany({
        where: {
          isScheduled: true,
          isBYOB: false,
          deactivatedAt: null,
          owner: { tier: { in: AI_TIERS as any } },
        },
        select: {
          id: true,
          handle: true,
          name: true,
          personality: true,
          tone: true,
          niche: true,
          aesthetic: true,
          artStyle: true,
          bio: true,
          botType: true,
          contentStyle: true,
          personaData: true,
          characterRef: true,
          characterRefDescription: true,
          owner: { select: { tier: true } },
        },
        take: MAX_BOTS_PER_RUN * 2, // Fetch extra to account for bots that already have buffer
      });

      // Check which bots already have enough buffered content
      const botsNeedingBuffer: typeof activeBots = [];

      for (const bot of activeBots) {
        if (botsNeedingBuffer.length >= MAX_BOTS_PER_RUN) break;

        const bufferCount = await prisma.contentBuffer.count({
          where: {
            botId: bot.id,
            status: "READY",
            expiresAt: { gt: new Date() },
          },
        });

        if (bufferCount < MAX_BUFFER_PER_BOT) {
          botsNeedingBuffer.push(bot);
        }
      }

      return botsNeedingBuffer.map((b) => ({
        id: b.id,
        handle: b.handle,
        ownerTier: b.owner.tier,
      }));
    });

    if (botsToFill.length === 0) {
      return { message: "All bots have sufficient buffer", filled: 0 };
    }

    // Step 2: Generate content for each bot (fan-out via events)
    let filled = 0;

    for (const bot of botsToFill) {
      const result = await step.run(`buffer-${bot.handle}`, async () => {
        try {
          // Get the full bot data for generation
          const fullBot = await prisma.bot.findUnique({
            where: { id: bot.id },
            include: { owner: { select: { tier: true } } },
          });

          if (!fullBot) return { success: false, reason: "Bot not found" };

          const generated = await generatePost(fullBot, bot.ownerTier);

          // Store in buffer instead of publishing
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + BUFFER_TTL_HOURS);

          await prisma.contentBuffer.create({
            data: {
              botId: bot.id,
              type: generated.type,
              content: generated.content,
              mediaUrl: generated.mediaUrl || null,
              thumbnailUrl: generated.thumbnailUrl || null,
              videoDuration: generated.videoDuration || null,
              tags: generated.tags,
              effectId: generated.effectId || null,
              effectVariant: generated.effectVariant || null,
              status: "READY",
              expiresAt,
            },
          });

          return { success: true };
        } catch (err: any) {
          console.warn(`Buffer generation failed for @${bot.handle}: ${err.message}`);
          return { success: false, reason: err.message };
        }
      });

      if (result.success) filled++;
    }

    // Step 3: Clean up expired buffer entries
    await step.run("cleanup-expired", async () => {
      await prisma.contentBuffer.deleteMany({
        where: {
          OR: [
            { status: "EXPIRED" },
            { status: "PUBLISHED" },
            { expiresAt: { lt: new Date() } },
          ],
        },
      });
    });

    return {
      botsChecked: botsToFill.length,
      filled,
    };
  },
);
