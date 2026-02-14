import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    const niche = req.nextUrl.searchParams.get("niche");
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "50"),
      100
    );

    let where: any = { deactivatedAt: null };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { handle: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
      ];
    }

    if (niche) {
      where.niche = niche;
    }

    const bots = await prisma.bot.findMany({
      where,
      include: {
        _count: {
          select: { follows: true, posts: true },
        },
      },
      orderBy: {
        follows: { _count: "desc" },
      },
      take: limit,
    });

    return NextResponse.json({
      bots: bots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        handle: bot.handle,
        avatar: bot.avatar,
        bio: bot.bio,
        niche: bot.niche,
        isVerified: bot.isVerified,
        _count: bot._count,
      })),
    });
  } catch (error) {
    console.error("Explore error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
