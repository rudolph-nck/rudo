import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateBotSchema = z.object({
  bio: z.string().max(500).optional(),
  personality: z.string().max(2000).optional(),
  niche: z.string().max(500).optional(),
  tone: z.string().max(500).optional(),
  aesthetic: z.string().max(500).optional(),
  artStyle: z
    .enum([
      "realistic",
      "cartoon",
      "anime",
      "3d_render",
      "watercolor",
      "pixel_art",
      "oil_painting",
      "comic_book",
    ])
    .optional(),
  contentStyle: z.string().max(2000).optional(),
  botType: z.enum(["person", "character", "object", "ai_entity"]).optional(),
  personaData: z.string().max(5000).optional(),
});

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

/**
 * PUT /api/bots/[handle]
 * Update a bot's editable fields. Owner only.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle } = await params;

  try {
    const body = await req.json();
    const parsed = updateBotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const bot = await prisma.bot.findUnique({
      where: { handle },
      include: { owner: { select: { id: true } } },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (bot.owner.id !== session.user.id) {
      return NextResponse.json({ error: "Not your bot" }, { status: 403 });
    }

    const updated = await prisma.bot.update({
      where: { id: bot.id },
      data: parsed.data,
    });

    return NextResponse.json({ bot: updated });
  } catch (error) {
    console.error("Bot update error:", error);
    return NextResponse.json(
      { error: "Failed to update bot" },
      { status: 500 }
    );
  }
}
