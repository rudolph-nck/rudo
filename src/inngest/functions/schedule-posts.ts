// Schedule posts — cron function that runs every 5 minutes.
// Finds bots that are due to post and sends generateContent events.
// Replaces the enqueue-then-process pattern with direct event dispatch.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

const AI_TIERS = ["SPARK", "PULSE", "GRID", "ADMIN"];

export const schedulePosts = inngest.createFunction(
  {
    id: "schedule-posts",
    name: "Schedule Bot Posts",
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    // Step 1: Find all due scheduled bots
    const dueBots = await step.run("find-due-bots", async () => {
      const now = new Date();

      const bots = await prisma.bot.findMany({
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

      // Filter to AI tiers only
      return bots
        .filter((b) => AI_TIERS.includes(b.owner.tier))
        .map((b) => ({
          id: b.id,
          handle: b.handle,
          ownerTier: b.owner.tier,
        }));
    });

    // Step 2: Find all due autonomous bots
    const dueAgents = await step.run("find-due-agents", async () => {
      const now = new Date();

      const bots = await prisma.bot.findMany({
        where: {
          agentMode: "autonomous",
          isScheduled: true,
          isBYOB: false,
          deactivatedAt: null,
          OR: [
            { nextCycleAt: null },
            { nextCycleAt: { lte: now } },
          ],
        },
        include: {
          owner: { select: { tier: true } },
        },
      });

      return bots
        .filter((b) => AI_TIERS.includes(b.owner.tier))
        .map((b) => ({
          id: b.id,
          handle: b.handle,
          ownerTier: b.owner.tier,
        }));
    });

    // Step 3: Send generation events for scheduled bots
    if (dueBots.length > 0) {
      await step.run("dispatch-generations", async () => {
        const events = dueBots.map((bot) => ({
          name: "bot/generate.content" as const,
          data: {
            botId: bot.id,
            ownerTier: bot.ownerTier,
            handle: bot.handle,
          },
        }));

        await inngest.send(events);
      });
    }

    // Step 4: Send agent cycle events for autonomous bots
    if (dueAgents.length > 0) {
      await step.run("dispatch-agent-cycles", async () => {
        const events = dueAgents.map((bot) => ({
          name: "bot/agent.cycle" as const,
          data: {
            botId: bot.id,
            ownerTier: bot.ownerTier,
            handle: bot.handle,
          },
        }));

        await inngest.send(events);
      });
    }

    // Step 5: Trigger crew interactions if any bots were scheduled
    if (dueBots.length > 0) {
      await step.run("dispatch-crew", async () => {
        await inngest.send({
          name: "bot/crew.interact",
          data: {},
        });
      });
    }

    return {
      scheduledBots: dueBots.length,
      agentCycles: dueAgents.length,
    };
  },
);
