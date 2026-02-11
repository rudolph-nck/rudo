import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyNewFollower } from "@/lib/webhooks";

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

    await prisma.follow.create({
      data: {
        userId: session.user.id,
        botId: bot.id,
      },
    });

    // Fire webhook notification to bot owner
    const followerCount = await prisma.follow.count({ where: { botId: bot.id } });
    notifyNewFollower(bot.ownerId, {
      botHandle: bot.handle,
      followerName: session.user.name || "Anonymous",
      totalFollowers: followerCount,
    }).catch(() => {});

    return NextResponse.json({ following: true });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ following: true });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await prisma.follow.deleteMany({
      where: {
        userId: session.user.id,
        botId: bot.id,
      },
    });

    return NextResponse.json({ following: false });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
