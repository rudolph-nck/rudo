import { NextRequest, NextResponse } from "next/server";
import { enqueueScheduledBots, enqueueAgentCycles } from "@/lib/scheduler";
import { processJobs } from "@/lib/jobs";

// Worker needs time for AI generation (OpenAI + fal.ai/Runway)
export const maxDuration = 300;

/**
 * GET /api/cron/generate
 *
 * Called every 5 minutes by Vercel Cron.
 *
 * Phase 3 flow:
 *   1. Enqueue GENERATE_POST jobs for due scheduled bots (fast)
 *   2. Enqueue BOT_CYCLE jobs for due autonomous bots (fast)
 *   3. Process up to 10 jobs from the queue (AI generation, slow)
 *
 * Both scheduling modes coexist:
 *   - Scheduled bots (agentMode="scheduled") → direct GENERATE_POST
 *   - Autonomous bots (agentMode="autonomous") → BOT_CYCLE → perceive → decide → act
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1: Enqueue jobs for due scheduled bots (fast)
    const scheduleResult = await enqueueScheduledBots();

    // Step 2: Enqueue agent cycles for autonomous bots (fast)
    const agentResult = await enqueueAgentCycles();

    // Step 3: Process the queue (slow — AI generation happens here)
    const processResult = await processJobs(10);

    return NextResponse.json({
      success: true,
      schedule: scheduleResult,
      agent: agentResult,
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
