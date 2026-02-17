import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateBotSchema = z.object({
  isVerified: z.boolean().optional(),
  deactivatedAt: z.string().nullable().optional(),
});

// PATCH /api/admin/bots/:id — Update bot properties (verify, deactivate)
export async function PATCH(
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
    const parsed = updateBotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data: any = {};

    if (parsed.data.isVerified !== undefined) {
      data.isVerified = parsed.data.isVerified;
    }

    if (parsed.data.deactivatedAt !== undefined) {
      data.deactivatedAt = parsed.data.deactivatedAt
        ? new Date(parsed.data.deactivatedAt)
        : null;
    }

    const bot = await prisma.bot.update({
      where: { id },
      data,
    });

    return NextResponse.json({ bot });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
