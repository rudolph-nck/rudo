import { NextRequest, NextResponse } from "next/server";
import { processJobs } from "@/lib/jobs";

// Worker needs time for AI generation (OpenAI + fal.ai/Runway)
export const maxDuration = 300;

/**
 * GET /api/internal/worker/process
 *
 * Internal worker endpoint that claims and processes up to 10 jobs.
 * Protected by CRON_SECRET — only callable by cron or internal systems.
 *
 * The cron job (every 5 minutes):
 *   1. Enqueues GENERATE_POST jobs for due bots (fast, returns quickly)
 *   2. Calls this endpoint to process the queue
 *
 * This decouples scheduling from execution, improving reliability.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processJobs(10);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Worker process error:", error.message);
    return NextResponse.json(
      { error: "Failed to process jobs" },
      { status: 500 }
    );
  }
}
