import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Pre-configured providers that match the existing codebase
const PROVIDERS = [
  {
    providerName: "openai",
    displayName: "OpenAI",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com",
    purpose: "TEXT_GENERATION" as const,
    capabilities: { video: false, image: false, audio: false, text: true },
    monthlyBudget: 200,
    alertThreshold: 20,
    priorityOrder: 1,
  },
  {
    providerName: "fal",
    displayName: "fal.ai",
    envKey: "FAL_KEY",
    baseUrl: "https://queue.fal.run",
    purpose: "MULTI_PURPOSE" as const,
    capabilities: { video: true, image: true, audio: false, text: false },
    monthlyBudget: 500,
    alertThreshold: 50,
    priorityOrder: 1,
  },
  {
    providerName: "runway",
    displayName: "Runway",
    envKey: "RUNWAY_API_KEY",
    baseUrl: "https://api.dev.runwayml.com",
    purpose: "VIDEO_GENERATION" as const,
    capabilities: { video: true, image: false, audio: false, text: false },
    monthlyBudget: 500,
    alertThreshold: 50,
    priorityOrder: 2,
  },
  {
    providerName: "minimax",
    displayName: "MiniMax (Hailuo)",
    envKey: "MINIMAX_API_KEY",
    baseUrl: "https://api.minimax.io",
    purpose: "VIDEO_GENERATION" as const,
    capabilities: { video: true, image: false, audio: false, text: false },
    monthlyBudget: 300,
    alertThreshold: 30,
    priorityOrder: 3,
  },
  {
    providerName: "kling",
    displayName: "Kling AI",
    envKey: "KLING_ACCESS_KEY",
    envSecret: "KLING_SECRET_KEY",
    baseUrl: "https://api.klingai.com",
    purpose: "VIDEO_GENERATION" as const,
    capabilities: { video: true, image: false, audio: false, text: false },
    monthlyBudget: 300,
    alertThreshold: 30,
    priorityOrder: 3,
  },
];

// POST /api/admin/credits/seed — Import existing providers from env variables
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const imported: string[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];

    for (const provider of PROVIDERS) {
      const apiKey = process.env[provider.envKey];
      const apiSecret = provider.envSecret
        ? process.env[provider.envSecret]
        : null;

      if (!apiKey) {
        missing.push(
          `${provider.displayName} — ${provider.envKey} not set`
        );
        continue;
      }

      // Check if already exists
      const existing = await prisma.apiProvider.findUnique({
        where: { providerName: provider.providerName },
      });

      if (existing) {
        skipped.push(`${provider.displayName} — already exists`);
        continue;
      }

      await prisma.apiProvider.create({
        data: {
          providerName: provider.providerName,
          displayName: provider.displayName,
          apiKey,
          apiSecret: apiSecret || null,
          baseUrl: provider.baseUrl,
          purpose: provider.purpose,
          capabilities: provider.capabilities,
          usedForEffects: [],
          monthlyBudget: provider.monthlyBudget,
          alertThreshold: provider.alertThreshold,
          priorityOrder: provider.priorityOrder,
          connectionStatus: "PENDING_TEST",
        },
      });

      imported.push(provider.displayName);
    }

    return NextResponse.json({
      imported,
      skipped,
      missing,
      message: `Imported ${imported.length} provider(s)`,
    });
  } catch (err) {
    console.error("Seed failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
