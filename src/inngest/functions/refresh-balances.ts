// Refresh provider balances — checks each API provider's actual balance.
// Runs every 4 hours to keep balance data accurate.
// Updates connectionStatus and triggers LOW_BALANCE alerts when needed.

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const refreshBalances = inngest.createFunction(
  {
    id: "refresh-balances",
    name: "Refresh Provider Balances",
    retries: 2,
  },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ step }) => {
    // Step 1: Get all active providers
    const providers = await step.run("load-providers", async () => {
      return prisma.apiProvider.findMany({
        where: { isActive: true },
        select: {
          id: true,
          providerName: true,
          displayName: true,
          apiKey: true,
          baseUrl: true,
          currentBalance: true,
          alertThreshold: true,
          lastBalanceCheck: true,
        },
      });
    });

    const results: { provider: string; balance?: number; error?: string }[] = [];

    // Step 2: Check each provider's balance
    for (const provider of providers) {
      const result = await step.run(`check-${provider.providerName}`, async () => {
        try {
          const balance = await fetchProviderBalance(provider);

          if (balance !== null) {
            // Update balance and check timestamp
            await prisma.apiProvider.update({
              where: { id: provider.id },
              data: {
                currentBalance: balance,
                lastBalanceCheck: new Date(),
                connectionStatus: "CONNECTED",
              },
            });

            // Record balance snapshot
            await prisma.apiBalanceHistory.create({
              data: {
                providerId: provider.id,
                balanceSnapshot: balance,
                changeReason: "BALANCE_SYNC",
              },
            });

            // Check alert threshold
            const threshold = Number(provider.alertThreshold || 0);
            if (threshold > 0 && balance < threshold) {
              const severity = balance < threshold * 0.5 ? "CRITICAL" : "WARNING";

              // Avoid duplicate alerts within the last hour
              const recent = await prisma.apiAlert.findFirst({
                where: {
                  providerId: provider.id,
                  alertType: "LOW_BALANCE",
                  isAcknowledged: false,
                  triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
                },
              });

              if (!recent) {
                await prisma.apiAlert.create({
                  data: {
                    providerId: provider.id,
                    alertType: "LOW_BALANCE",
                    message: `${provider.displayName} balance is $${balance.toFixed(2)} (below $${threshold.toFixed(2)} threshold)`,
                    severity: severity as any,
                  },
                });
              }

              // Update connection status
              if (balance <= 0) {
                await prisma.apiProvider.update({
                  where: { id: provider.id },
                  data: { connectionStatus: "LOW_BALANCE" },
                });
              }
            }

            return { provider: provider.providerName, balance };
          }

          return { provider: provider.providerName, error: "Could not fetch balance" };
        } catch (err: any) {
          // Mark as error if we can't reach the provider
          await prisma.apiProvider.update({
            where: { id: provider.id },
            data: {
              connectionStatus: "ERROR",
              lastBalanceCheck: new Date(),
            },
          });

          return { provider: provider.providerName, error: err.message };
        }
      });

      results.push(result);
    }

    return { checked: results.length, results };
  },
);

/**
 * Fetch the actual balance from a provider's API.
 * Each provider has its own balance endpoint and response format.
 */
async function fetchProviderBalance(provider: {
  providerName: string;
  apiKey: string;
  baseUrl: string | null;
}): Promise<number | null> {
  const { providerName, apiKey } = provider;

  try {
    switch (providerName.toLowerCase()) {
      case "openai": {
        // OpenAI doesn't have a direct balance API for most accounts
        // Return null to skip balance check (tracked via usage logs)
        return null;
      }

      case "fal":
      case "fal.ai": {
        // fal.ai doesn't expose a public balance API
        // Balance tracked via usage logs
        return null;
      }

      case "runway":
      case "runwayml": {
        // Runway credits are tracked via their dashboard
        // No public balance API
        return null;
      }

      case "minimax": {
        const res = await fetch("https://api.minimaxi.chat/v1/query/user/balance", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        // MiniMax returns balance in cents, convert to USD
        return (data?.balance || 0) / 100;
      }

      case "kling": {
        // Kling balance checked via their console
        return null;
      }

      case "elevenlabs": {
        const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
          headers: { "xi-api-key": apiKey },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.character_limit ? data.character_limit - (data.character_count || 0) : null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
