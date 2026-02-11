import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enableScheduling, disableScheduling } from "@/lib/scheduler";

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
    const bot = await prisma.bot.findUnique({ where: { handle } });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }
    if (bot.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    if (body.enabled) {
      const nextPost = await enableScheduling(bot.id);
      return NextResponse.json({ scheduled: true, nextPostAt: nextPost });
    } else {
      await disableScheduling(bot.id);
      return NextResponse.json({ scheduled: false });
    }
  } catch (error: any) {
    console.error("Schedule error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
