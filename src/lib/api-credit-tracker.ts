import { prisma } from "@/lib/prisma";

/**
 * API Credit Tracker — wraps external API calls to automatically log usage,
 * track spending, update provider balances, and trigger alerts.
 *
 * Usage:
 *   const result = await callTrackedAPI("minimax", "/v1/video/generation", params, {
 *     botId: "clx...",
 *     effectId: "falling_from_sky",
 *     postId: "clx...",
 *   });
 */

type CallMetadata = {
  botId?: string;
  effectId?: string;
  postId?: string;
};

type TrackedResponse = {
  ok: boolean;
  status: number;
  data: any;
  creditsUsed?: number;
  costUsd?: number;
  responseTimeMs: number;
  provider: string;
  usedFallback: boolean;
};

// Rough cost estimates per provider when actual cost isn't returned
const COST_ESTIMATES: Record<string, number> = {
  minimax: 0.50,
  hailua: 0.45,
  kling: 1.99,
  runway: 1.50,
  runwayml: 1.50,
  elevenlabs: 0.30,
  fal: 0.10,
  "fal.ai": 0.10,
  openai: 0.02,
};

async function getProviderConfig(providerName: string) {
  return prisma.apiProvider.findUnique({
    where: { providerName },
    include: {
      fallbackProvider: {
        select: {
          id: true,
          providerName: true,
          apiKey: true,
          baseUrl: true,
          isActive: true,
          alertThreshold: true,
          currentBalance: true,
        },
      },
    },
  });
}

async function createAlert(
  providerId: number,
  alertType: "LOW_BALANCE" | "BUDGET_EXCEEDED" | "API_ERROR" | "RATE_LIMITED" | "DISCONNECTED",
  message: string,
  severity: "CRITICAL" | "WARNING" | "INFO" = "WARNING"
) {
  // Avoid duplicate alerts within the last hour
  const recentAlert = await prisma.apiAlert.findFirst({
    where: {
      providerId,
      alertType,
      isAcknowledged: false,
      triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (!recentAlert) {
    await prisma.apiAlert.create({
      data: { providerId, alertType, message, severity },
    });
  }
}

async function logUsage(entry: {
  botId: string | null;
  providerId: number;
  effectId: string | null;
  endpoint: string;
  creditsUsed: number;
  costUsd: number;
  requestParams: any;
  responseStatus: number;
  responseTimeMs: number;
  postId: string | null;
  status: "SUCCESS" | "FAILED" | "RATE_LIMITED" | "INSUFFICIENT_CREDITS";
  errorMessage?: string;
}) {
  await prisma.apiUsageLog.create({
    data: {
      botId: entry.botId,
      providerId: entry.providerId,
      effectId: entry.effectId,
      endpoint: entry.endpoint,
      creditsUsed: entry.creditsUsed,
      costUsd: entry.costUsd,
      requestParams: entry.requestParams,
      responseStatus: entry.responseStatus,
      responseTimeMs: entry.responseTimeMs,
      postId: entry.postId,
      status: entry.status,
      errorMessage: entry.errorMessage || null,
    },
  });
}

async function makeRequest(
  providerConfig: {
    apiKey: string;
    baseUrl: string | null;
    providerName: string;
  },
  endpoint: string,
  params: any
) {
  const baseUrl = providerConfig.baseUrl || "";
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Provider-specific auth headers
  switch (providerConfig.providerName.toLowerCase()) {
    case "elevenlabs":
      headers["xi-api-key"] = providerConfig.apiKey;
      break;
    case "fal":
    case "fal.ai":
      headers["Authorization"] = `Key ${providerConfig.apiKey}`;
      break;
    default:
      headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

export async function callTrackedAPI(
  providerName: string,
  endpoint: string,
  params: any,
  metadata: CallMetadata = {}
): Promise<TrackedResponse> {
  const startTime = Date.now();
  const providerConfig = await getProviderConfig(providerName);

  if (!providerConfig) {
    throw new Error(`Provider "${providerName}" not found`);
  }

  if (!providerConfig.isActive) {
    throw new Error(`Provider "${providerName}" is disabled`);
  }

  // Check balance threshold
  const balance = Number(providerConfig.currentBalance);
  const threshold = Number(providerConfig.alertThreshold || 0);
  if (threshold > 0 && balance < threshold) {
    await createAlert(
      providerConfig.id,
      "LOW_BALANCE",
      `${providerConfig.displayName} balance is $${balance.toFixed(2)} (below $${threshold.toFixed(2)} threshold)`,
      balance < threshold * 0.5 ? "CRITICAL" : "WARNING"
    );
  }

  let response: { ok: boolean; status: number; data: any };
  let usedFallback = false;
  let actualProviderId = providerConfig.id;
  let actualProviderName = providerName;

  try {
    response = await makeRequest(providerConfig, endpoint, params);

    if (!response.ok) {
      const statusCode = response.status;

      if (statusCode === 429) {
        await createAlert(
          providerConfig.id,
          "RATE_LIMITED",
          `${providerConfig.displayName}: Rate limited on ${endpoint}`
        );

        await logUsage({
          botId: metadata.botId || null,
          providerId: providerConfig.id,
          effectId: metadata.effectId || null,
          endpoint,
          creditsUsed: 0,
          costUsd: 0,
          requestParams: params,
          responseStatus: statusCode,
          responseTimeMs: Date.now() - startTime,
          postId: metadata.postId || null,
          status: "RATE_LIMITED",
          errorMessage: "Rate limited",
        });

        // Try fallback
        if (providerConfig.fallbackProvider?.isActive) {
          response = await makeRequest(
            providerConfig.fallbackProvider,
            endpoint,
            params
          );
          usedFallback = true;
          actualProviderId = providerConfig.fallbackProvider.id;
          actualProviderName = providerConfig.fallbackProvider.providerName;
        } else {
          throw new Error(`Rate limited and no fallback available`);
        }
      } else {
        await createAlert(
          providerConfig.id,
          "API_ERROR",
          `${providerConfig.displayName}: HTTP ${statusCode} on ${endpoint}`
        );

        // Try fallback on 5xx errors
        if (
          statusCode >= 500 &&
          providerConfig.fallbackProvider?.isActive
        ) {
          response = await makeRequest(
            providerConfig.fallbackProvider,
            endpoint,
            params
          );
          usedFallback = true;
          actualProviderId = providerConfig.fallbackProvider.id;
          actualProviderName = providerConfig.fallbackProvider.providerName;
        } else if (!response.ok) {
          await logUsage({
            botId: metadata.botId || null,
            providerId: providerConfig.id,
            effectId: metadata.effectId || null,
            endpoint,
            creditsUsed: 0,
            costUsd: 0,
            requestParams: params,
            responseStatus: statusCode,
            responseTimeMs: Date.now() - startTime,
            postId: metadata.postId || null,
            status: "FAILED",
            errorMessage: `HTTP ${statusCode}`,
          });
          throw new Error(
            `${providerConfig.displayName} API error: HTTP ${statusCode}`
          );
        }
      }
    }
  } catch (err: any) {
    // If we already logged and re-threw, just rethrow
    if (err.message?.includes("API error") || err.message?.includes("Rate limited")) {
      throw err;
    }

    // Network error — try fallback
    if (providerConfig.fallbackProvider?.isActive) {
      response = await makeRequest(
        providerConfig.fallbackProvider,
        endpoint,
        params
      );
      usedFallback = true;
      actualProviderId = providerConfig.fallbackProvider.id;
      actualProviderName = providerConfig.fallbackProvider.providerName;
    } else {
      await logUsage({
        botId: metadata.botId || null,
        providerId: providerConfig.id,
        effectId: metadata.effectId || null,
        endpoint,
        creditsUsed: 0,
        costUsd: 0,
        requestParams: params,
        responseStatus: 0,
        responseTimeMs: Date.now() - startTime,
        postId: metadata.postId || null,
        status: "FAILED",
        errorMessage: err.message,
      });
      throw err;
    }
  }

  const responseTime = Date.now() - startTime;
  const creditsUsed = response.data?.creditsUsed || 0;
  const costUsd =
    response.data?.costUsd ||
    COST_ESTIMATES[actualProviderName.toLowerCase()] ||
    0;

  // Log successful usage
  await logUsage({
    botId: metadata.botId || null,
    providerId: actualProviderId,
    effectId: metadata.effectId || null,
    endpoint,
    creditsUsed,
    costUsd,
    requestParams: params,
    responseStatus: response.status,
    responseTimeMs: responseTime,
    postId: metadata.postId || null,
    status: "SUCCESS",
  });

  // Update provider's last successful call timestamp
  await prisma.apiProvider.update({
    where: { id: actualProviderId },
    data: { lastSuccessfulCall: new Date() },
  });

  // Update balance if credits were tracked
  if (creditsUsed > 0) {
    await prisma.apiProvider.update({
      where: { id: actualProviderId },
      data: {
        currentBalance: { decrement: creditsUsed },
      },
    });

    await prisma.apiBalanceHistory.create({
      data: {
        providerId: actualProviderId,
        balanceSnapshot: 0, // Will be updated by balance refresh job
        changeAmount: -creditsUsed,
        changeReason: "API_CALL_USAGE",
      },
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    data: response.data,
    creditsUsed,
    costUsd,
    responseTimeMs: responseTime,
    provider: actualProviderName,
    usedFallback,
  };
}
