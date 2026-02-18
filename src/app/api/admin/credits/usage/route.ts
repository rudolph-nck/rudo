import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/credits/usage — Query usage analytics with filters
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const provider = searchParams.get("provider");
    const botId = searchParams.get("botId");
    const effectId = searchParams.get("effectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const groupBy = searchParams.get("groupBy") || "daily";
    const view = searchParams.get("view"); // "by-effect" | "by-bot" | "recent"

    const where: any = {};
    if (provider) {
      const prov = await prisma.apiProvider.findUnique({
        where: { providerName: provider },
        select: { id: true },
      });
      if (prov) where.providerId = prov.id;
    }
    if (botId) where.botId = botId;
    if (effectId) where.effectId = effectId;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate)
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    // By Effect breakdown
    if (view === "by-effect") {
      const effectGroups = await prisma.apiUsageLog.groupBy({
        by: ["effectId"],
        where: { ...where, effectId: { not: null } },
        _sum: { costUsd: true },
        _count: { _all: true },
        _avg: { costUsd: true },
        orderBy: { _sum: { costUsd: "desc" } },
        take: 20,
      });

      const data = effectGroups.map((g) => ({
        effectId: g.effectId,
        totalCost: Number(g._sum.costUsd || 0),
        totalCalls: g._count._all,
        avgCostPerCall: Number(g._avg.costUsd || 0),
      }));

      return NextResponse.json({ data });
    }

    // By Bot breakdown
    if (view === "by-bot") {
      const botGroups = await prisma.apiUsageLog.groupBy({
        by: ["botId"],
        where: { ...where, botId: { not: null } },
        _sum: { costUsd: true },
        _count: { _all: true },
        orderBy: { _sum: { costUsd: "desc" } },
        take: 20,
      });

      // Fetch bot names
      const botIds = botGroups
        .map((g) => g.botId)
        .filter(Boolean) as string[];
      const bots = await prisma.bot.findMany({
        where: { id: { in: botIds } },
        select: { id: true, name: true, handle: true },
      });
      const botMap = new Map(bots.map((b) => [b.id, b]));

      const data = botGroups.map((g) => {
        const bot = botMap.get(g.botId || "");
        return {
          botId: g.botId,
          botName: bot?.name || g.botId,
          botHandle: bot?.handle || null,
          totalCost: Number(g._sum.costUsd || 0),
          totalCalls: g._count._all,
        };
      });

      return NextResponse.json({ data });
    }

    // Recent API calls
    if (view === "recent") {
      const logs = await prisma.apiUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          provider: { select: { providerName: true, displayName: true } },
        },
      });

      return NextResponse.json({
        data: logs.map((l) => ({
          id: l.id,
          provider: l.provider.displayName,
          providerName: l.provider.providerName,
          botId: l.botId,
          effectId: l.effectId,
          costUsd: Number(l.costUsd),
          creditsUsed: Number(l.creditsUsed),
          status: l.status,
          responseTimeMs: l.responseTimeMs,
          errorMessage: l.errorMessage,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    }

    // Default: aggregate by day/week/month for charts
    const logs = await prisma.apiUsageLog.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        provider: { select: { providerName: true, displayName: true } },
      },
    });

    // Group by date bucket
    const buckets = new Map<
      string,
      {
        date: string;
        totalCost: number;
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        byProvider: Map<string, { cost: number; calls: number }>;
      }
    >();

    for (const log of logs) {
      const d = log.createdAt;
      let key: string;
      if (groupBy === "weekly") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (groupBy === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else {
        key = d.toISOString().split("T")[0];
      }

      if (!buckets.has(key)) {
        buckets.set(key, {
          date: key,
          totalCost: 0,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          byProvider: new Map(),
        });
      }

      const bucket = buckets.get(key)!;
      const cost = Number(log.costUsd);
      bucket.totalCost += cost;
      bucket.totalCalls += 1;
      if (log.status === "SUCCESS") bucket.successfulCalls += 1;
      else bucket.failedCalls += 1;

      const provName = log.provider.providerName;
      if (!bucket.byProvider.has(provName)) {
        bucket.byProvider.set(provName, { cost: 0, calls: 0 });
      }
      const prov = bucket.byProvider.get(provName)!;
      prov.cost += cost;
      prov.calls += 1;
    }

    const data = Array.from(buckets.values()).map((b) => ({
      date: b.date,
      totalCost: Math.round(b.totalCost * 100) / 100,
      totalCalls: b.totalCalls,
      successfulCalls: b.successfulCalls,
      failedCalls: b.failedCalls,
      successRate:
        b.totalCalls > 0
          ? Math.round((b.successfulCalls / b.totalCalls) * 1000) / 10
          : 0,
      breakdown: Array.from(b.byProvider.entries()).map(([name, d]) => ({
        provider: name,
        cost: Math.round(d.cost * 100) / 100,
        calls: d.calls,
      })),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Failed to fetch usage:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
