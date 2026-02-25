// Agent Action Module — Phase 3
// Routes an agent's decision to the appropriate job queue action.
// Pure enqueue — no heavy work happens here.

import { prisma } from "../prisma";
import { enqueueJob } from "../jobs/enqueue";
import type { AgentDecision, AgentCycleResult } from "./types";

/**
 * Execute an agent's decision by enqueuing the appropriate job.
 * Updates the bot's agent state and schedules the next cycle.
 */
export async function act(
  botId: string,
  decision: AgentDecision,
  cooldownMinutes: number
): Promise<AgentCycleResult> {
  let enqueuedJobId: string | undefined;

  switch (decision.action) {
    case "CREATE_POST": {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { owner: { select: { tier: true } } },
      });
      if (bot) {
        const job = await enqueueJob({
          type: "GENERATE_POST",
          botId,
          payload: { ownerTier: bot.owner.tier, handle: bot.handle, source: "agent" },
        });
        enqueuedJobId = job.id;
      }
      break;
    }

    case "RESPOND_TO_COMMENT": {
      if (decision.targetId) {
        const job = await enqueueJob({
          type: "RESPOND_TO_COMMENT",
          botId,
          payload: {
            commentId: decision.targetId,
            contextHint: decision.contextHint,
          },
        });
        enqueuedJobId = job.id;
      }
      break;
    }

    case "RESPOND_TO_POST": {
      if (decision.targetId) {
        const job = await enqueueJob({
          type: "RESPOND_TO_POST",
          botId,
          payload: {
            postId: decision.targetId,
            contextHint: decision.contextHint,
          },
        });
        enqueuedJobId = job.id;
      }
      break;
    }

    case "LIKE_POST": {
      // Likes are instant — no AI generation needed, just a DB write.
      // No job queue needed; executed inline.
      if (decision.targetId) {
        const bot = await prisma.bot.findUnique({
          where: { id: botId },
          select: { ownerId: true },
        });
        if (bot) {
          try {
            await prisma.like.create({
              data: {
                userId: bot.ownerId,
                postId: decision.targetId,
                origin: "SYSTEM",
              },
            });
          } catch {
            // Already liked — unique constraint, safe to ignore
          }
        }
      }
      break;
    }

    case "IDLE":
      // No job to enqueue — just schedule the next cycle
      break;
  }

  // Schedule next cycle based on priority
  const nextCycleAt = calculateNextCycle(decision, cooldownMinutes);

  // Update bot agent state
  await prisma.bot.update({
    where: { id: botId },
    data: {
      lastDecisionAt: new Date(),
      nextCycleAt,
    },
  });

  return {
    botId,
    action: decision.action,
    reasoning: decision.reasoning,
    enqueuedJobId,
    nextCycleAt,
  };
}

/**
 * Calculate when the next agent cycle should run based on the decision's priority.
 * High priority = shorter cooldown, low priority = longer cooldown.
 */
export function calculateNextCycle(
  decision: AgentDecision,
  cooldownMinutes: number
): Date {
  const multiplier =
    decision.priority === "high" ? 0.5 :
    decision.priority === "medium" ? 1.0 :
    2.0; // low priority = longer wait

  // IDLE decisions get extra cooldown
  const idleBonus = decision.action === "IDLE" ? 1.5 : 1.0;

  const minutes = cooldownMinutes * multiplier * idleBonus;

  // Add 20% jitter to avoid thundering herd
  const jitter = minutes * 0.2 * (Math.random() * 2 - 1);

  return new Date(Date.now() + (minutes + jitter) * 60 * 1000);
}
