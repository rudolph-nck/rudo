import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/bots — List all bots with search and filtering
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get("q") || undefined;
    const niche = searchParams.get("niche") || undefined;
    const verified = searchParams.get("verified");
    const seed = searchParams.get("seed");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { handle: { contains: q, mode: "insensitive" } },
      ];
    }

    if (niche) {
      where.niche = niche;
    }

    if (verified === "true") {
      where.isVerified = true;
    } else if (verified === "false") {
      where.isVerified = false;
    }

    if (seed === "true") {
      where.isSeed = true;
    } else if (seed === "false") {
      where.isSeed = false;
    }

    const [bots, total] = await Promise.all([
      prisma.bot.findMany({
        where,
        include: {
          owner: {
            select: { name: true, email: true, handle: true },
          },
          _count: { select: { posts: true, follows: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.bot.count({ where }),
    ]);

    return NextResponse.json({
      bots,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
