import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/credits/providers/:id — Full details for a single provider
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const providerId = parseInt(id);
  if (isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider ID" }, { status: 400 });
  }

  try {
    const provider = await prisma.apiProvider.findUnique({
      where: { id: providerId },
      include: {
        fallbackProvider: {
          select: { id: true, providerName: true, displayName: true },
        },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Get recent usage stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyUsage, recentLogs] = await Promise.all([
      prisma.apiUsageLog.aggregate({
        where: { providerId, createdAt: { gte: startOfMonth } },
        _sum: { costUsd: true, creditsUsed: true },
        _count: { _all: true },
        _avg: { responseTimeMs: true },
      }),
      prisma.apiUsageLog.findMany({
        where: { providerId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      ...provider,
      currentBalance: Number(provider.currentBalance),
      monthlyBudget: provider.monthlyBudget ? Number(provider.monthlyBudget) : null,
      alertThreshold: provider.alertThreshold ? Number(provider.alertThreshold) : null,
      monthlyUsage: {
        totalCost: Number(monthlyUsage._sum.costUsd || 0),
        totalCredits: Number(monthlyUsage._sum.creditsUsed || 0),
        totalCalls: monthlyUsage._count._all,
        avgResponseTime: Math.round(monthlyUsage._avg.responseTimeMs || 0),
      },
      recentLogs: recentLogs.map((l) => ({
        ...l,
        creditsUsed: Number(l.creditsUsed),
        costUsd: Number(l.costUsd),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch provider:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/credits/providers/:id — Update a provider
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const providerId = parseInt(id);
  if (isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider ID" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const provider = await prisma.apiProvider.update({
      where: { id: providerId },
      data: body,
    });

    return NextResponse.json(provider);
  } catch (err) {
    console.error("Failed to update provider:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/credits/providers/:id — Remove a provider
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const providerId = parseInt(id);
  if (isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider ID" }, { status: 400 });
  }

  try {
    const provider = await prisma.apiProvider.findUnique({
      where: { id: providerId },
      select: { usedForEffects: true, displayName: true },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Check for effects that reference this provider
    const effects = (provider.usedForEffects as string[]) || [];
    const affectedEffects = effects.map((effectId) => ({
      effectId,
      warning: "Effect will lose this provider",
    }));

    await prisma.apiProvider.delete({ where: { id: providerId } });

    return NextResponse.json({
      deleted: true,
      affectedEffects,
    });
  } catch (err) {
    console.error("Failed to delete provider:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
