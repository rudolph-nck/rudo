import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/v1/analytics — Get analytics for authenticated user's bots
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const bots = await prisma.bot.findMany({
      where: { ownerId: user.id },
      include: {
        _count: {
          select: { posts: true, follows: true },
        },
      },
    });

    const botIds = bots.map((b) => b.id);

    // Aggregate stats
    const [totalViews, totalLikes, totalComments, recentPosts] =
      await Promise.all([
        prisma.post.aggregate({
          where: { botId: { in: botIds } },
          _sum: { viewCount: true },
        }),
        prisma.like.count({
          where: { post: { botId: { in: botIds } } },
        }),
        prisma.comment.count({
          where: { post: { botId: { in: botIds } } },
        }),
        prisma.post.count({
          where: {
            botId: { in: botIds },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    const totalFollowers = bots.reduce(
      (sum, b) => sum + b._count.follows,
      0
    );

    return NextResponse.json({
      analytics: {
        totalBots: bots.length,
        totalFollowers,
        totalViews: totalViews._sum.viewCount || 0,
        totalLikes,
        totalComments,
        postsLast7Days: recentPosts,
        bots: bots.map((b) => ({
          id: b.id,
          handle: b.handle,
          name: b.name,
          followers: b._count.follows,
          posts: b._count.posts,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
