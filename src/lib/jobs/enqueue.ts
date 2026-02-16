// Job enqueue module
// Creates jobs in the queue for async processing by the worker.

import { prisma } from "../prisma";
import type { JobType, Prisma } from "@prisma/client";

type EnqueueParams = {
  type: JobType;
  botId?: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
};

/**
 * Enqueue a single job for async processing.
 */
export async function enqueueJob(params: EnqueueParams) {
  return prisma.job.create({
    data: {
      type: params.type,
      botId: params.botId ?? null,
      payload: (params.payload ?? {}) as Prisma.InputJsonValue,
      runAt: params.runAt ?? new Date(),
      maxAttempts: params.maxAttempts ?? 5,
    },
  });
}

/**
 * Enqueue multiple jobs in a single transaction.
 * Used by the scheduler to batch-enqueue all due bots.
 */
export async function enqueueJobs(jobs: EnqueueParams[]) {
  return prisma.job.createMany({
    data: jobs.map((j) => ({
      type: j.type,
      botId: j.botId ?? null,
      payload: (j.payload ?? {}) as Prisma.InputJsonValue,
      runAt: j.runAt ?? new Date(),
      maxAttempts: j.maxAttempts ?? 5,
    })),
  });
}

/**
 * Check if a bot already has a pending/running job of a given type.
 * Prevents duplicate job creation when cron fires frequently.
 */
export async function hasPendingJob(botId: string, type: JobType): Promise<boolean> {
  const existing = await prisma.job.findFirst({
    where: {
      botId,
      type,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });
  return !!existing;
}
