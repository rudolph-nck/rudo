// Check alerts — monitors provider health and triggers alerts.
// Runs every 30 minutes to catch issues quickly.
// Checks: stale providers, high error rates, budget overruns.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const checkAlerts = inngest.createFunction(
  {
    id: "check-alerts",
    name: "Check Provider Alerts",
    retries: 1,
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    const alerts: string[] = [];

    // Check 1: Providers with no successful calls in last 2 hours
    await step.run("check-stale-providers", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const providers = await prisma.apiProvider.findMany({
        where: {
          isActive: true,
          lastSuccessfulCall: { lt: twoHoursAgo },
        },
        select: {
          id: true,
          providerName: true,
          displayName: true,
          lastSuccessfulCall: true,
        },
      });

      for (const provider of providers) {
        // Only alert if there have been recent attempts (not just inactive)
        const recentAttempts = await prisma.apiUsageLog.count({
          where: {
            providerId: provider.id,
            createdAt: { gte: twoHoursAgo },
          },
        });

        if (recentAttempts > 0) {
          const existing = await prisma.apiAlert.findFirst({
            where: {
              providerId: provider.id,
              alertType: "DISCONNECTED",
              isAcknowledged: false,
              triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
          });

          if (!existing) {
            await prisma.apiAlert.create({
              data: {
                providerId: provider.id,
                alertType: "DISCONNECTED",
                message: `${provider.displayName} has not had a successful call since ${provider.lastSuccessfulCall?.toISOString() || "never"}`,
                severity: "WARNING",
              },
            });
            alerts.push(`DISCONNECTED: ${provider.displayName}`);
          }
        }
      }
    });

    // Check 2: High error rate in last hour
    await step.run("check-error-rates", async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const providers = await prisma.apiProvider.findMany({
        where: { isActive: true },
        select: { id: true, providerName: true, displayName: true },
      });

      for (const provider of providers) {
        const [totalCalls, failedCalls] = await Promise.all([
          prisma.apiUsageLog.count({
            where: {
              providerId: provider.id,
              createdAt: { gte: oneHourAgo },
            },
          }),
          prisma.apiUsageLog.count({
            where: {
              providerId: provider.id,
              createdAt: { gte: oneHourAgo },
              status: { in: ["FAILED", "RATE_LIMITED"] },
            },
          }),
        ]);

        // Alert if error rate > 50% and at least 5 calls
        if (totalCalls >= 5 && failedCalls / totalCalls > 0.5) {
          const existing = await prisma.apiAlert.findFirst({
            where: {
              providerId: provider.id,
              alertType: "API_ERROR",
              isAcknowledged: false,
              triggeredAt: { gte: oneHourAgo },
            },
          });

          if (!existing) {
            await prisma.apiAlert.create({
              data: {
                providerId: provider.id,
                alertType: "API_ERROR",
                message: `${provider.displayName} has ${Math.round(failedCalls / totalCalls * 100)}% error rate in the last hour (${failedCalls}/${totalCalls} calls)`,
                severity: "CRITICAL",
              },
            });
            alerts.push(`HIGH_ERROR_RATE: ${provider.displayName}`);
          }
        }
      }
    });

    // Check 3: Monthly budget overruns
    await step.run("check-budgets", async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const startOfMonth = new Date(year, month - 1, 1);

      const providers = await prisma.apiProvider.findMany({
        where: {
          isActive: true,
          monthlyBudget: { not: null },
        },
        select: {
          id: true,
          providerName: true,
          displayName: true,
          monthlyBudget: true,
        },
      });

      for (const provider of providers) {
        const monthlySpend = await prisma.apiUsageLog.aggregate({
          where: {
            providerId: provider.id,
            createdAt: { gte: startOfMonth },
            status: "SUCCESS",
          },
          _sum: { costUsd: true },
        });

        const spent = Number(monthlySpend._sum.costUsd || 0);
        const budget = Number(provider.monthlyBudget || 0);

        if (budget > 0 && spent >= budget * 0.8) {
          const severity = spent >= budget ? "CRITICAL" : "WARNING";

          const existing = await prisma.apiAlert.findFirst({
            where: {
              providerId: provider.id,
              alertType: "BUDGET_EXCEEDED",
              isAcknowledged: false,
              triggeredAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
            },
          });

          if (!existing) {
            await prisma.apiAlert.create({
              data: {
                providerId: provider.id,
                alertType: "BUDGET_EXCEEDED",
                message: `${provider.displayName}: $${spent.toFixed(2)} spent of $${budget.toFixed(2)} monthly budget (${Math.round(spent / budget * 100)}%)`,
                severity: severity as any,
              },
            });
            alerts.push(`BUDGET: ${provider.displayName}`);
          }
        }
      }
    });

    return { alertsTriggered: alerts.length, alerts };
  },
);
