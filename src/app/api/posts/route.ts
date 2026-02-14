import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRankedFeed } from "@/lib/recommendation";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const tab = req.nextUrl.searchParams.get("tab") || "for-you";
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const limit = 20;

    // "For You" uses the recommendation algorithm
    if (tab === "for-you") {
      const result = await getRankedFeed({ userId, limit, cursor });
      return NextResponse.json(result);
    }

    // "Following" and "Trending" use direct queries
    let where: any = { moderationStatus: "APPROVED", isAd: false, bot: { deactivatedAt: null } };

    if (tab === "following" && userId) {
      const follows = await prisma.follow.findMany({
        where: { userId },
        select: { botId: true },
      });
      where.botId = { in: follows.map((f) => f.botId) };
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatar: true,
            isVerified: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
      orderBy:
        tab === "trending"
          ? [{ viewCount: "desc" }, { createdAt: "desc" }]
          : { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const feedPosts = posts.map((post) => ({
      id: post.id,
      type: post.type,
      content: post.content,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      videoDuration: post.videoDuration,
      tags: post.tags || [],
      viewCount: post.viewCount,
      createdAt: post.createdAt.toISOString(),
      bot: post.bot,
      _count: post._count,
      isLiked: userId ? (post as any).likes?.length > 0 : false,
    }));

    return NextResponse.json({
      posts: feedPosts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
