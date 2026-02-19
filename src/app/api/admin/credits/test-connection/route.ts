import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

async function testProvider(provider: {
  id: number;
  providerName: string;
  displayName: string;
  apiKey: string;
  apiSecret: string | null;
  baseUrl: string | null;
}) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url = "";
    let headers: Record<string, string> = {};
    let method = "GET";

    switch (provider.providerName.toLowerCase()) {
      case "openai": {
        // GET /v1/models — lightweight, just lists available models
        url = `${provider.baseUrl || "https://api.openai.com"}/v1/models`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        break;
      }

      case "fal":
      case "fal.ai": {
        // fal.ai doesn't have a dedicated health endpoint — hit the queue
        // status for a known model. Any non-network-error = connected.
        url = "https://queue.fal.run/fal-ai/flux/dev/status";
        headers = { Authorization: `Key ${provider.apiKey}` };
        break;
      }

      case "runway":
      case "runwayml": {
        // GET /v1/tasks lists recent tasks — lightweight auth check
        url = `${provider.baseUrl || "https://api.dev.runwayml.com"}/v1/tasks`;
        headers = {
          Authorization: `Bearer ${provider.apiKey}`,
          "X-Runway-Version": "2024-11-06",
        };
        break;
      }

      case "minimax": {
        // Query the video generation status endpoint with a dummy task
        // to verify auth. A 200 or 400 "invalid task_id" both prove the key works.
        const base = provider.baseUrl || "https://api.minimax.io";
        url = `${base}/v1/query/video_generation?task_id=test`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        break;
      }

      case "kling": {
        // Kling uses JWT auth signed with access key + secret key
        if (!provider.apiSecret) {
          clearTimeout(timeout);
          return {
            provider: provider.providerName,
            displayName: provider.displayName,
            status: "error" as const,
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

        // GET a known endpoint — list tasks returns empty array if no tasks
        url = `${provider.baseUrl || "https://api.klingai.com"}/v1/videos/text2video`;
        headers = { Authorization: `Bearer ${token}` };
        // Kling's list endpoint is GET, so this works
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
            status: "error" as const,
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

    // Any response from the server means connectivity is fine.
    // 2xx = key works. 401/403 = connected but bad key. 4xx/5xx = connected but issue.
    if (res.ok) {
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: {
          connectionStatus: "CONNECTED",
          lastBalanceCheck: new Date(),
          lastSuccessfulCall: new Date(),
        },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "connected" as const,
        latencyMs: latency,
      };
    }

    if (res.status === 401 || res.status === 403) {
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: { connectionStatus: "ERROR" },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "error" as const,
        latencyMs: latency,
        error: `${res.status} Unauthorized. Check API key.`,
      };
    }

    // For Minimax, a 400 on the query endpoint still proves the key works
    // (it just means "invalid task_id" which is expected)
    if (
      provider.providerName.toLowerCase() === "minimax" &&
      res.status === 400
    ) {
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: {
          connectionStatus: "CONNECTED",
          lastBalanceCheck: new Date(),
          lastSuccessfulCall: new Date(),
        },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "connected" as const,
        latencyMs: latency,
      };
    }

    // fal.ai: 404/405 on the status endpoint still proves connectivity + valid key
    if (
      ["fal", "fal.ai"].includes(provider.providerName.toLowerCase()) &&
      (res.status === 404 || res.status === 405 || res.status === 422)
    ) {
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: {
          connectionStatus: "CONNECTED",
          lastBalanceCheck: new Date(),
          lastSuccessfulCall: new Date(),
        },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: "connected" as const,
        latencyMs: latency,
      };
    }

    await prisma.apiProvider.update({
      where: { id: provider.id },
      data: { connectionStatus: "ERROR" },
    });

    return {
      provider: provider.providerName,
      displayName: provider.displayName,
      status: "error" as const,
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
      status: "error" as const,
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
