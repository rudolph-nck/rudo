// Job claim module
// Atomically claims jobs that are ready to run.
// Uses raw SQL with FOR UPDATE SKIP LOCKED to prevent race conditions
// when multiple workers run concurrently.

import { prisma } from "../prisma";
import type { Job } from "@prisma/client";

/**
 * Atomically claim up to `limit` jobs that are ready to run.
 *
 * Uses Postgres advisory locking pattern:
 * 1. SELECT ... WHERE status IN ('QUEUED','RETRY') AND runAt <= now
 *    FOR UPDATE SKIP LOCKED
 * 2. UPDATE status = 'RUNNING', lockedAt = now, attempts += 1
 *
 * This is safe under concurrent workers — each job is claimed exactly once.
 */
export async function claimJobs(limit: number = 10): Promise<Job[]> {
  const now = new Date();

  // Use a transaction with raw SQL for the atomic claim
  const claimed = await prisma.$transaction(async (tx) => {
    // Step 1: Find ready jobs and lock them
    const ready = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM jobs
      WHERE status IN ('QUEUED', 'RETRY')
        AND "runAt" <= ${now}
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (ready.length === 0) return [];

    const ids = ready.map((r) => r.id);

    // Step 2: Mark them as RUNNING
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "RUNNING",
        lockedAt: now,
        attempts: { increment: 1 },
      },
    });

    // Step 3: Return the full job objects
    return tx.job.findMany({
      where: { id: { in: ids } },
      orderBy: { runAt: "asc" },
    });
  });

  return claimed;
}

/**
 * Mark a job as succeeded.
 */
export async function succeedJob(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      lockedAt: null,
    },
  });
}

/**
 * Mark a job as failed. If it has retries left, schedule a retry with
 * exponential backoff. Otherwise mark it permanently failed.
 */
export async function failJob(jobId: string, error: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.attempts < job.maxAttempts) {
    // Exponential backoff: 30s, 60s, 120s, 240s, ...
    const backoffSeconds = 30 * Math.pow(2, job.attempts - 1);
    const retryAt = new Date(Date.now() + backoffSeconds * 1000);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "RETRY",
        lockedAt: null,
        lastError: error,
        runAt: retryAt,
      },
    });
  } else {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: error,
      },
    });
  }
}
