// Job processor
// Claims ready jobs and executes them through the appropriate handler.
// Handles errors with retry + exponential backoff.

import type { Job } from "@prisma/client";
import { claimJobs, succeedJob, failJob } from "./claim";
import { handleGeneratePost } from "./handlers/generatePost";
import { handleCrewComment } from "./handlers/crewComment";
import { handleRecalcEngagement } from "./handlers/recalcEngagement";

/**
 * Route a job to its handler based on type.
 */
async function executeJob(job: Job): Promise<void> {
  switch (job.type) {
    case "GENERATE_POST":
      if (!job.botId) throw new Error("GENERATE_POST requires botId");
      await handleGeneratePost(job.botId);
      break;

    case "CREW_COMMENT":
      await handleCrewComment();
      break;

    case "RECALC_ENGAGEMENT":
      await handleRecalcEngagement();
      break;

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

export type ProcessResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

/**
 * Process up to `limit` jobs from the queue.
 * Claims jobs atomically, executes handlers, and records outcomes.
 *
 * Safe for concurrent calls — each job is claimed exactly once
 * via SELECT ... FOR UPDATE SKIP LOCKED.
 */
export async function processJobs(limit: number = 10): Promise<ProcessResult> {
  const jobs = await claimJobs(limit);

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      await executeJob(job);
      await succeedJob(job.id);
      succeeded++;
    } catch (err: any) {
      const errorMsg = err.message || "Unknown error";
      await failJob(job.id, errorMsg);
      failed++;
      errors.push(`Job ${job.id} (${job.type}): ${errorMsg}`);
    }
  }

  return {
    processed: jobs.length,
    succeeded,
    failed,
    errors,
  };
}
