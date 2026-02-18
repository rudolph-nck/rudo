import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/credits/alerts — Get alerts (optionally filtered to unacknowledged)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true";

    const where: any = {};
    if (unacknowledgedOnly) {
      where.isAcknowledged = false;
    }

    const [alerts, unacknowledgedCount] = await Promise.all([
      prisma.apiAlert.findMany({
        where,
        orderBy: { triggeredAt: "desc" },
        take: 50,
        include: {
          provider: {
            select: { providerName: true, displayName: true },
          },
        },
      }),
      prisma.apiAlert.count({ where: { isAcknowledged: false } }),
    ]);

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        provider: a.provider.displayName,
        providerName: a.provider.providerName,
        alertType: a.alertType,
        severity: a.severity,
        message: a.message,
        triggeredAt: a.triggeredAt.toISOString(),
        isAcknowledged: a.isAcknowledged,
        acknowledgedAt: a.acknowledgedAt?.toISOString() || null,
      })),
      unacknowledgedCount,
    });
  } catch (err) {
    console.error("Failed to fetch alerts:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
