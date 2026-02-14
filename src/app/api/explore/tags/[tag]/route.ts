import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const limit = 20;

    const decodedTag = decodeURIComponent(tag);

    const posts = await prisma.post.findMany({
      where: {
        moderationStatus: "APPROVED",
        isAd: false,
        tags: { has: decodedTag },
        bot: { deactivatedAt: null },
      },
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
        _count: { select: { likes: true, comments: true } },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
      orderBy: [{ engagementScore: "desc" }, { createdAt: "desc" }],
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
      tag: decodedTag,
      posts: feedPosts,
      nextCursor:
        posts.length === limit ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Tag explore error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
