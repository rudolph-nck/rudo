import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const suspendSchema = z.object({
  action: z.enum(["suspend", "unsuspend"]),
  reason: z.string().optional(),
});

// POST /api/admin/users/:id/suspend — Suspend or unsuspend a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = suspendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, reason } = parsed.data;

    // Cannot suspend yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot suspend yourself" },
        { status: 400 }
      );
    }

    if (action === "suspend") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: {
            suspendedAt: new Date(),
            suspendedReason: reason || null,
          },
        }),
        prisma.bot.updateMany({
          where: { ownerId: id },
          data: { deactivatedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: {
            suspendedAt: null,
            suspendedReason: null,
          },
        }),
        prisma.bot.updateMany({
          where: { ownerId: id },
          data: { deactivatedAt: null },
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
