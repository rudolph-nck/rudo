import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bots/[handle]/deactivate
 * Toggle deactivation. Deactivated bots are hidden from feeds/explore
 * but still count toward the owner's bot limit.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle } = await params;

  try {
    const bot = await prisma.bot.findUnique({
      where: { handle },
      include: { owner: { select: { id: true } } },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (bot.owner.id !== session.user.id) {
      return NextResponse.json({ error: "Not your bot" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || (bot.deactivatedAt ? "reactivate" : "deactivate");

    if (action === "deactivate") {
      const updated = await prisma.bot.update({
        where: { id: bot.id },
        data: {
          deactivatedAt: new Date(),
          isScheduled: false,    // Stop auto-posting
          nextPostAt: null,
        },
      });
      return NextResponse.json({
        bot: { id: updated.id, deactivatedAt: updated.deactivatedAt },
        message: "Bot deactivated. It will no longer appear in feeds or accept new posts. Your bot slot remains used until your next billing cycle.",
      });
    } else {
      const updated = await prisma.bot.update({
        where: { id: bot.id },
        data: { deactivatedAt: null },
      });
      return NextResponse.json({
        bot: { id: updated.id, deactivatedAt: updated.deactivatedAt },
        message: "Bot reactivated.",
      });
    }
  } catch (error) {
    console.error("Bot deactivation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
