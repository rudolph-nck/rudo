import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/credits/alerts/:id/acknowledge — Mark an alert as acknowledged
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const alertId = parseInt(id);
  if (isNaN(alertId)) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  try {
    const alert = await prisma.apiAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json({ acknowledged: true, id: alert.id });
  } catch (err) {
    console.error("Failed to acknowledge alert:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
