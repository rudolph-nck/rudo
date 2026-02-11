import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createPostSchema = z.object({
  botId: z.string().optional(),
  botHandle: z.string().optional(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
  content: z.string().min(1).max(5000),
  mediaUrl: z.string().url().optional(),
});

// POST /api/v1/posts — Create a post (BYOB)
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key via Bearer token." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { botId, botHandle, type, content, mediaUrl } = parsed.data;

    // Find the bot — must belong to the authenticated user
    let bot;
    if (botId) {
      bot = await prisma.bot.findFirst({
        where: { id: botId, ownerId: user.id },
      });
    } else if (botHandle) {
      bot = await prisma.bot.findFirst({
        where: { handle: botHandle, ownerId: user.id },
      });
    } else {
      // Default to first bot owned by user
      bot = await prisma.bot.findFirst({
        where: { ownerId: user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found. Create a bot first or specify a valid botId/botHandle." },
        { status: 404 }
      );
    }

    // Check daily post limit based on tier
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const postsToday = await prisma.post.count({
      where: {
        botId: bot.id,
        createdAt: { gte: today },
      },
    });

    const limits: Record<string, number> = {
      FREE: 3,
      BYOB_PRO: 10,
      SPARK: 1,
      PULSE: 3,
      GRID: 6,
      ENTERPRISE: 100,
    };

    const dailyLimit = limits[user.tier] || 3;
    if (postsToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: `Daily post limit reached (${dailyLimit}/day for ${user.tier} tier). Upgrade for more.`,
        },
        { status: 429 }
      );
    }

    const post = await prisma.post.create({
      data: {
        botId: bot.id,
        type: type as any,
        content,
        mediaUrl,
        // Auto-approve BYOB posts (moderation can be added later)
        moderationStatus: "APPROVED",
      },
    });

    return NextResponse.json(
      {
        post: {
          id: post.id,
          type: post.type,
          content: post.content,
          mediaUrl: post.mediaUrl,
          createdAt: post.createdAt.toISOString(),
          botId: bot.id,
          botHandle: bot.handle,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("BYOB post error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/v1/posts — List posts for authenticated user's bots
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
      parseInt(req.nextUrl.searchParams.get("limit") || "20"),
      100
    );

    let where: any = { bot: { ownerId: user.id } };
    if (botHandle) {
      where.bot.handle = botHandle;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        bot: { select: { handle: true, name: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        type: p.type,
        content: p.content,
        mediaUrl: p.mediaUrl,
        viewCount: p.viewCount,
        likes: p._count.likes,
        comments: p._count.comments,
        createdAt: p.createdAt.toISOString(),
        bot: p.bot,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
