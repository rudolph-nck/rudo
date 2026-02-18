import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function testProvider(provider: {
  id: number;
  providerName: string;
  displayName: string;
  apiKey: string;
  baseUrl: string | null;
}) {
  const start = Date.now();

  try {
    // Attempt a lightweight request to verify the API key is valid
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url = provider.baseUrl || "";
    let headers: Record<string, string> = {};

    // Provider-specific health check endpoints
    switch (provider.providerName.toLowerCase()) {
      case "minimax":
        url = `${url || "https://api.minimax.chat"}/v1/models`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        break;
      case "runway":
      case "runwayml":
        url = `${url || "https://api.dev.runwayml.com"}/v1/tasks`;
        headers = { Authorization: `Bearer ${provider.apiKey}` };
        break;
      case "elevenlabs":
        url = `${url || "https://api.elevenlabs.io"}/v1/user`;
        headers = { "xi-api-key": provider.apiKey };
        break;
      case "fal":
      case "fal.ai":
        url = `${url || "https://queue.fal.run"}/fal-ai/flux/dev`;
        headers = { Authorization: `Key ${provider.apiKey}` };
        break;
      default:
        // Generic — just try hitting the base URL
        if (!url) {
          return {
            provider: provider.providerName,
            displayName: provider.displayName,
            status: "error" as const,
            latencyMs: null,
            error: "No base URL configured",
          };
        }
        headers = { Authorization: `Bearer ${provider.apiKey}` };
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (res.ok || res.status === 401) {
      // 401 still means we connected — key is just wrong
      const connected = res.ok;
      await prisma.apiProvider.update({
        where: { id: provider.id },
        data: {
          connectionStatus: connected ? "CONNECTED" : "ERROR",
          lastBalanceCheck: connected ? new Date() : undefined,
        },
      });

      return {
        provider: provider.providerName,
        displayName: provider.displayName,
        status: connected ? ("connected" as const) : ("error" as const),
        latencyMs: latency,
        error: connected ? undefined : "401 Unauthorized. Check API key.",
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
      error: err.name === "AbortError" ? "Connection timed out (10s)" : err.message,
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
        baseUrl: true,
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
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
