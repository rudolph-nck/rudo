// Aggregate monthly spending summaries — runs at the start of each day.
// Rolls up API usage logs into MonthlySpendingSummary records.
// Provides the admin dashboard with monthly cost breakdowns per provider.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const aggregateStats = inngest.createFunction(
  {
    id: "aggregate-stats",
    name: "Aggregate Monthly Stats",
    retries: 2,
  },
  { cron: "0 1 * * *" }, // Daily at 1 AM UTC
  async ({ step }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    // Get all active providers
    const providers = await step.run("load-providers", async () => {
      return prisma.apiProvider.findMany({
        where: { isActive: true },
        select: { id: true, providerName: true },
      });
    });

    const summaries: { provider: string; calls: number; cost: number }[] = [];

    for (const provider of providers) {
      const summary = await step.run(`aggregate-${provider.providerName}`, async () => {
        // Get all usage logs for this month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 1);

        const logs = await prisma.apiUsageLog.aggregate({
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
          },
          _sum: {
            creditsUsed: true,
            costUsd: true,
            responseTimeMs: true,
          },
          _count: true,
        });

        const successCount = await prisma.apiUsageLog.count({
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
            status: "SUCCESS",
          },
        });

        const failedCount = await prisma.apiUsageLog.count({
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
            status: { in: ["FAILED", "RATE_LIMITED", "INSUFFICIENT_CREDITS"] },
          },
        });

        // Find top effect and top bot for this provider this month
        const topEffectResult = await prisma.apiUsageLog.groupBy({
          by: ["effectId"],
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
            effectId: { not: null },
          },
          _count: true,
          orderBy: { _count: { effectId: "desc" } },
          take: 1,
        });

        const topBotResult = await prisma.apiUsageLog.groupBy({
          by: ["botId"],
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
            botId: { not: null },
          },
          _count: true,
          orderBy: { _count: { botId: "desc" } },
          take: 1,
        });

        const totalCalls = logs._count;
        const totalCost = Number(logs._sum.costUsd || 0);
        const totalCredits = Number(logs._sum.creditsUsed || 0);
        const totalResponseTime = Number(logs._sum.responseTimeMs || 0);

        // Upsert the monthly summary
        await prisma.monthlySpendingSummary.upsert({
          where: {
            year_month_providerId: { year, month, providerId: provider.id },
          },
          create: {
            year,
            month,
            providerId: provider.id,
            totalCreditsUsed: totalCredits,
            totalCostUsd: totalCost,
            totalApiCalls: totalCalls,
            successfulCalls: successCount,
            failedCalls: failedCount,
            avgCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
            avgResponseTimeMs: totalCalls > 0 ? Math.round(totalResponseTime / totalCalls) : null,
            topEffect: topEffectResult[0]?.effectId || null,
            topBot: topBotResult[0]?.botId || null,
          },
          update: {
            totalCreditsUsed: totalCredits,
            totalCostUsd: totalCost,
            totalApiCalls: totalCalls,
            successfulCalls: successCount,
            failedCalls: failedCount,
            avgCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
            avgResponseTimeMs: totalCalls > 0 ? Math.round(totalResponseTime / totalCalls) : null,
            topEffect: topEffectResult[0]?.effectId || null,
            topBot: topBotResult[0]?.botId || null,
          },
        });

        return {
          provider: provider.providerName,
          calls: totalCalls,
          cost: totalCost,
        };
      });

      summaries.push(summary);
    }

    return {
      year,
      month,
      providers: summaries,
    };
  },
);
