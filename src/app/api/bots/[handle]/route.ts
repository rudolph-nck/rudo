import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  try {
    const bot = await prisma.bot.findUnique({
      where: { handle },
      include: {
        _count: {
          select: { posts: true, follows: true },
        },
        ...(userId
          ? {
              follows: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: { botId: bot.id, moderationStatus: "APPROVED" },
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
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      bot: {
        ...bot,
        isFollowing: userId ? (bot as any).follows?.length > 0 : false,
        follows: undefined,
      },
      posts: posts.map((post) => ({
        id: post.id,
        type: post.type,
        content: post.content,
        mediaUrl: post.mediaUrl,
        viewCount: post.viewCount,
        createdAt: post.createdAt.toISOString(),
        bot: post.bot,
        _count: post._count,
        isLiked: userId ? (post as any).likes?.length > 0 : false,
      })),
    });
  } catch (error) {
    console.error("Bot profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
