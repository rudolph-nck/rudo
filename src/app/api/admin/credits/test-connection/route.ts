import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

type TestResult = {
  provider: string;
  displayName: string;
  status: "connected" | "error";
  latencyMs: number | null;
  currentBalance?: number | null;
  error?: string;
};

/**
 * Try to fetch the balance/credits from a provider's API.
 * Returns the balance in USD or null if the provider doesn't expose it.
 */
async function fetchBalance(
  providerName: string,
  apiKey: string,
  apiSecret: string | null,
  baseUrl: string | null
): Promise<number | null> {
  try {
    switch (providerName.toLowerCase()) {
      case "elevenlabs": {
        // GET /v1/user → subscription.character_count / character_limit
        const res = await fetch(
          `${baseUrl || "https://api.elevenlabs.io"}/v1/user`,
          { headers: { "xi-api-key": apiKey } }
        );
        if (res.ok) {
          const data = await res.json();
          const remaining =
            (data.subscription?.character_limit || 0) -
            (data.subscription?.character_count || 0);
          return remaining;
        }
        return null;
      }

      case "openai": {
        // OpenAI doesn't expose credits via the regular API key.
        // Billing is at organization level via a separate dashboard.
        return null;
      }

      case "fal":
      case "fal.ai": {
        // fal.ai is pay-as-you-go, no balance endpoint via key.
        return null;
      }

      case "runway":
      case "runwayml": {
        // Runway is credit-based but no REST balance endpoint.
        return null;
      }

      case "minimax": {
        // MiniMax doesn't expose a balance check endpoint.
        return null;
      }

      case "kling": {
        // Kling doesn't expose a balance check endpoint.
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function testProvider(provider: {
  id: number;
  providerName: string;
  displayName: string;
  apiKey: string;
  apiSecret: string | null;
  baseUrl: string | null;
  currentBalance: any;
}): Promise<TestResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url = "";
    let headers: Record<string, string> = {};
    let method = "GET";
    // Providers where a non-2xx response still proves auth works
    let acceptStatus: number[] = [];

    switch (provider.providerName.toLowerCase()) {
      case "openai": {
        // GET /v1/models — lightweight, just lists available models
        url = `${provider.baseUrl || "https://api.openai.com"}/v1/models`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        break;
      }

      case "fal":
      case "fal.ai": {
        // Hit the queue status endpoint. 422 = connected (missing request_id).
        url = "https://queue.fal.run/fal-ai/flux/dev/status";
        headers = { Authorization: `Key ${provider.apiKey}` };
        acceptStatus = [404, 405, 422];
        break;
      }

      case "runway":
      case "runwayml": {
        // Runway SDK only has GET /v1/tasks/{id} — no list endpoint.
        // Request a fake task ID: 404 proves auth passed, 401 means bad key.
        url = `${provider.baseUrl || "https://api.dev.runwayml.com"}/v1/tasks/test-connection-ping`;
        headers = {
          Authorization: `Bearer ${provider.apiKey}`,
          "X-Runway-Version": "2024-11-06",
        };
        acceptStatus = [404, 422];
        break;
      }

      case "minimax": {
        // Query video status with a dummy task_id.
        // 400 "invalid task_id" proves the key works.
        const base = provider.baseUrl || "https://api.minimax.io";
        url = `${base}/v1/query/video_generation?task_id=test`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        acceptStatus = [400];
        break;
      }

      case "kling": {
        // Kling uses JWT auth signed with access key + secret key
        if (!provider.apiSecret) {
          clearTimeout(timeout);
          return {
            provider: provider.providerName,
            displayName: provider.displayName,
            status: "error",
            latencyMs: null,
            error: "Missing KLING_SECRET_KEY (api_secret)",
          };
        }

        const now = Math.floor(Date.now() / 1000);
        const token = jwt.sign(
          { iss: provider.apiKey, exp: now + 1800, nbf: now - 5 },
          provider.apiSecret,
          { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } }
        );

        url = `${provider.baseUrl || "https://api.klingai.com"}/v1/videos/text2video`;
        headers = { Authorization: `Bearer ${token}` };
        break;
      }

      case "elevenlabs": {
        // GET /v1/user returns user info + subscription credits
        url = `${provider.baseUrl || "https://api.elevenlabs.io"}/v1/user`;
        headers = { "xi-api-key": provider.apiKey };
        break;
      }

      default: {
        if (!provider.baseUrl) {
          clearTimeout(timeout);
          return {
            provider: provider.providerName,
            displayName: provider.displayName,
            status: "error",
            latencyMs: null,
            error: "No base URL configured",
          };
        }
        url = provider.baseUrl;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
      }
    }

    const res = await fetch(url, { method, headers, signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    const isConnected = res.ok || acceptStatus.includes(res.status);

    if (res.status === 401 || res.status === 403) {
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: { connectionStatus: "ERROR" },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "error",
        latencyMs: latency,
        error: `${res.status} Unauthorized. Check API key.`,
      };
    }

    if (isConnected) {
      // Try to fetch balance from the provider
      const balance = await fetchBalance(
        provider.providerName,
        provider.apiKey,
        provider.apiSecret,
        provider.baseUrl
      );

      const updateData: any = {
        connectionStatus: "CONNECTED",
        lastBalanceCheck: new Date(),
        lastSuccessfulCall: new Date(),
      };

      // Only update balance if we got a real value from the API
      if (balance !== null) {
        updateData.currentBalance = balance;
      }

      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: updateData,
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "connected",
        latencyMs: latency,
        currentBalance: balance ?? Number(provider.currentBalance),
      };
    }

    await prisma.apiProvider.update({
      where: { id: provider.id },
      data: { connectionStatus: "ERROR" },
    });

    return {
      provider: provider.providerName,
      displayName: provider.displayName,
      status: "error",
      latencyMs: latency,
      error: `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    const latency = Date.now() - start;
    await prisma.apiProvider.update({
      where: { id: provider.id },
      data: { connectionStatus: "DISCONNECTED" },
    });

    return {
      provider: provider.providerName,
      displayName: provider.displayName,
      status: "error",
      latencyMs: latency > 10000 ? null : latency,
      error:
        err.name === "AbortError"
          ? "Connection timed out (10s)"
          : err.message,
    };
  }
}

// POST /api/admin/credits/test-connection — Test one or all provider connections
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { providerId, testAll } = body;

    if (testAll) {
      const providers = await prisma.apiProvider.findMany({
        where: { isActive: true },
        select: {
          id: true,
          providerName: true,
          displayName: true,
          apiKey: true,
          apiSecret: true,
          baseUrl: true,
          currentBalance: true,
        },
      });

      const results = await Promise.all(providers.map(testProvider));

      const connected = results.filter((r) => r.status === "connected").length;
      return NextResponse.json({
        results,
        summary: {
          total: results.length,
          connected,
          failed: results.length - connected,
        },
      });
    }

    if (!providerId) {
      return NextResponse.json(
        { error: "providerId or testAll required" },
        { status: 400 }
      );
    }

    const provider = await prisma.apiProvider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        providerName: true,
        displayName: true,
        apiKey: true,
        apiSecret: true,
        baseUrl: true,
        currentBalance: true,
      },
    });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const result = await testProvider(provider);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Connection test failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
