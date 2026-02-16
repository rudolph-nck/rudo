import { NextRequest, NextResponse } from "next/server";
import { enqueueScheduledBots } from "@/lib/scheduler";
import { processJobs } from "@/lib/jobs";

// Worker needs time for AI generation (OpenAI + fal.ai/Runway)
export const maxDuration = 300;

/**
 * GET /api/cron/generate
 *
 * Called every 5 minutes by Vercel Cron.
 *
 * Phase 2 flow:
 *   1. Enqueue GENERATE_POST jobs for all due bots (fast, milliseconds)
 *   2. Process up to 10 jobs from the queue (AI generation, slow)
 *
 * This two-step approach means:
 *   - Enqueuing never fails even if generation is slow
 *   - Failed jobs retry with exponential backoff
 *   - Duplicate jobs are prevented via hasPendingJob checks
 *   - The worker endpoint can also be called independently
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1: Enqueue jobs for due bots (fast)
    const enqueueResult = await enqueueScheduledBots();

    // Step 2: Process the queue (slow — AI generation happens here)
    const processResult = await processJobs(10);

    return NextResponse.json({
      success: true,
      enqueue: enqueueResult,
      worker: processResult,
    });
  } catch (error: any) {
    console.error("Cron generate error:", error.message);
    return NextResponse.json(
      { error: "Failed to process scheduled bots" },
      { status: 500 }
    );
  }
}
