import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStats } from "@/lib/ai/telemetry";

/**
 * GET /api/internal/health/generation
 *
 * Health check endpoint showing generation pipeline status:
 *   - Queue stats (pending, running, failed jobs)
 *   - Telemetry stats (provider usage, success rates, costs)
 *   - Recent failure details
 *
 * Protected by CRON_SECRET — only callable by internal systems.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Queue stats from the job table
    const [queuedCount, runningCount, failedRecent, retryCount, succeededRecent] =
      await Promise.all([
        prisma.job.count({ where: { status: "QUEUED" } }),
        prisma.job.count({ where: { status: "RUNNING" } }),
        prisma.job.count({
          where: { status: "FAILED", updatedAt: { gte: oneDayAgo } },
        }),
        prisma.job.count({ where: { status: "RETRY" } }),
        prisma.job.count({
          where: { status: "SUCCEEDED", updatedAt: { gte: oneDayAgo } },
        }),
      ]);

    // Recent failures with error details
    const recentFailures = await prisma.job.findMany({
      where: { status: "FAILED", updatedAt: { gte: oneDayAgo } },
      select: {
        id: true,
        type: true,
        botId: true,
        lastError: true,
        attempts: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    // Stuck jobs (RUNNING for over 1 hour)
    const stuckJobs = await prisma.job.count({
      where: { status: "RUNNING", lockedAt: { lte: oneHourAgo } },
    });

    // Telemetry stats from in-memory ring buffer
    const telemetry = getStats();

    return NextResponse.json({
      status: "ok",
      timestamp: now.toISOString(),
      queue: {
        queued: queuedCount,
        running: runningCount,
        retry: retryCount,
        failedLast24h: failedRecent,
        succeededLast24h: succeededRecent,
        stuckJobs,
      },
      telemetry: {
        totalCalls: telemetry.totalCalls,
        successRate:
          telemetry.totalCalls > 0
            ? Math.round((telemetry.successCount / telemetry.totalCalls) * 100)
            : 100,
        avgDurationMs: telemetry.avgDurationMs,
        totalEstimatedCostCents: telemetry.totalEstimatedCostCents,
        byProvider: telemetry.byProvider,
      },
      recentFailures,
      recentTelemetry: telemetry.recentEntries,
    });
  } catch (error: any) {
    console.error("Health check error:", error.message);
    return NextResponse.json(
      { status: "error", error: "Failed to gather health stats" },
      { status: 500 }
    );
  }
}
