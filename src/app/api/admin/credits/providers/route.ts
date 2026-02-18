import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createProviderSchema = z.object({
  providerName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(500),
  apiSecret: z.string().max(500).optional(),
  baseUrl: z.string().url().optional(),
  purpose: z.enum([
    "VIDEO_GENERATION",
    "IMAGE_GENERATION",
    "AUDIO_GENERATION",
    "TEXT_GENERATION",
    "MULTI_PURPOSE",
  ]),
  capabilities: z.object({
    video: z.boolean(),
    image: z.boolean(),
    audio: z.boolean(),
    text: z.boolean(),
  }),
  usedForEffects: z.array(z.string()).optional(),
  monthlyBudget: z.number().min(0).optional(),
  alertThreshold: z.number().min(0).optional(),
  priorityOrder: z.number().int().min(1).optional(),
  fallbackProviderId: z.number().int().optional().nullable(),
});

// GET /api/admin/credits/providers — List all providers with spending totals
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [providers, spentToday, spentThisWeek, spentThisMonth] =
      await Promise.all([
        prisma.apiProvider.findMany({
          orderBy: { priorityOrder: "asc" },
          include: {
            fallbackProvider: {
              select: { id: true, providerName: true, displayName: true },
            },
          },
        }),
        prisma.apiUsageLog.aggregate({
          where: { createdAt: { gte: startOfDay }, status: "SUCCESS" },
          _sum: { costUsd: true },
        }),
        prisma.apiUsageLog.aggregate({
          where: { createdAt: { gte: startOfWeek }, status: "SUCCESS" },
          _sum: { costUsd: true },
        }),
        prisma.apiUsageLog.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: "SUCCESS" },
          _sum: { costUsd: true },
        }),
      ]);

    // Get per-provider monthly spending
    const providerMonthlySpending = await prisma.apiUsageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfMonth }, status: "SUCCESS" },
      _sum: { costUsd: true },
    });

    const spendingMap = new Map(
      providerMonthlySpending.map((s) => [
        s.providerId,
        Number(s._sum.costUsd || 0),
      ])
    );

    const totalMonthlyBudget = providers.reduce(
      (sum, p) => sum + Number(p.monthlyBudget || 0),
      0
    );
    const totalSpentThisMonth = Number(spentThisMonth._sum.costUsd || 0);

    const mappedProviders = providers.map((p) => {
      const spentThisMonthForProvider = spendingMap.get(p.id) || 0;
      const budget = Number(p.monthlyBudget || 0);
      return {
        id: p.id,
        providerName: p.providerName,
        displayName: p.displayName,
        purpose: p.purpose,
        capabilities: p.capabilities,
        usedForEffects: p.usedForEffects,
        currentBalance: Number(p.currentBalance),
        currency: p.balanceCurrency,
        monthlyBudget: budget,
        spentThisMonth: spentThisMonthForProvider,
        percentBudgetUsed: budget > 0
          ? Math.round((spentThisMonthForProvider / budget) * 1000) / 10
          : 0,
        alertThreshold: Number(p.alertThreshold || 0),
        connectionStatus: p.connectionStatus,
        priorityOrder: p.priorityOrder,
        fallbackProvider: p.fallbackProvider?.providerName || null,
        lastBalanceCheck: p.lastBalanceCheck?.toISOString() || null,
        lastSuccessfulCall: p.lastSuccessfulCall?.toISOString() || null,
        isActive: p.isActive,
      };
    });

    return NextResponse.json({
      providers: mappedProviders,
      totals: {
        spentToday: Number(spentToday._sum.costUsd || 0),
        spentThisWeek: Number(spentThisWeek._sum.costUsd || 0),
        spentThisMonth: totalSpentThisMonth,
        totalMonthlyBudget: totalMonthlyBudget,
        percentTotalBudgetUsed:
          totalMonthlyBudget > 0
            ? Math.round((totalSpentThisMonth / totalMonthlyBudget) * 1000) / 10
            : 0,
      },
    });
  } catch (err) {
    console.error("Failed to fetch providers:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/credits/providers — Add a new API connection
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createProviderSchema.parse(body);

    const provider = await prisma.apiProvider.create({
      data: {
        providerName: data.providerName,
        displayName: data.displayName,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret || null,
        baseUrl: data.baseUrl || null,
        purpose: data.purpose as any,
        capabilities: data.capabilities,
        usedForEffects: data.usedForEffects || [],
        monthlyBudget: data.monthlyBudget || null,
        alertThreshold: data.alertThreshold || null,
        priorityOrder: data.priorityOrder || 1,
        fallbackProviderId: data.fallbackProviderId || null,
        connectionStatus: "PENDING_TEST",
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Failed to create provider:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
