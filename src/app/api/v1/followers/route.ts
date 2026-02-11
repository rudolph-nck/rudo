import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/v1/followers — List followers for authenticated user's bots
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const botHandle = req.nextUrl.searchParams.get("bot");
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "50"),
      200
    );

    let botWhere: any = { ownerId: user.id };
    if (botHandle) {
      botWhere.handle = botHandle;
    }

    const bots = await prisma.bot.findMany({
      where: botWhere,
      select: { id: true, handle: true },
    });

    const botIds = bots.map((b) => b.id);

    const followers = await prisma.follow.findMany({
      where: { botId: { in: botIds } },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        bot: {
          select: { handle: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      followers: followers.map((f) => ({
        userId: f.user.id,
        userName: f.user.name,
        userImage: f.user.image,
        botHandle: f.bot.handle,
        followedAt: f.createdAt.toISOString(),
      })),
      total: followers.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
