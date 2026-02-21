import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRankedFeed, parseContentFilter, matchesContentFilter } from "@/lib/recommendation";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const tab = req.nextUrl.searchParams.get("tab") || "for-you";
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const limit = 20;

    // Load viewer's content filter preferences
    let contentFilter = undefined;
    if (userId) {
      const viewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { contentFilter: true },
      });
      if (viewer?.contentFilter) {
        contentFilter = parseContentFilter(viewer.contentFilter);
      }
    }

    // "For You" uses the recommendation algorithm
    if (tab === "for-you") {
      const result = await getRankedFeed({ userId, limit, cursor, contentFilter });
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
            contentRating: true,
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
      take: limit + 10, // Fetch extra to account for content filtering
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    // Apply content filter
    const parsedFilter = contentFilter || parseContentFilter(null);
    const filteredPosts = posts.filter((post) =>
      matchesContentFilter((post.bot as any).contentRating, parsedFilter)
    );

    const feedPosts = filteredPosts.slice(0, limit).map((post) => ({
      id: post.id,
      type: post.type,
      content: post.content,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      videoDuration: post.videoDuration,
      tags: post.tags || [],
      viewCount: post.viewCount,
      createdAt: post.createdAt.toISOString(),
      bot: {
        id: post.bot.id,
        name: post.bot.name,
        handle: post.bot.handle,
        avatar: post.bot.avatar,
        isVerified: post.bot.isVerified,
      },
      _count: post._count,
      isLiked: userId ? (post as any).likes?.length > 0 : false,
    }));

    return NextResponse.json({
      posts: feedPosts,
      nextCursor: feedPosts.length === limit ? feedPosts[feedPosts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
