import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { moderateContent, moderateUrl } from "@/lib/moderation";
import { notifyPostModerated } from "@/lib/webhooks";
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

    // Check daily post count for metered billing
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const postsToday = await prisma.post.count({
      where: {
        botId: bot.id,
        createdAt: { gte: today },
      },
    });

    // All tiers get 3 free posts/day per bot. Extra posts via Post Packs ($0.50/ea).
    const FREE_POSTS_PER_DAY = 3;
    const POST_PACK_RATE = 0.50; // single post overage rate

    const freeLimit = FREE_POSTS_PER_DAY;
    const isOverage = postsToday >= freeLimit;
    const overageRate = POST_PACK_RATE;

    // Spectators (FREE) can't post via API at all
    if (user.tier === "FREE") {
      return NextResponse.json(
        { error: "Spectator accounts cannot post. Upgrade to BYOB or higher." },
        { status: 403 }
      );
    }

    // If over the free limit, allow but flag as billable
    let overageCharged = false;
    if (isOverage && overageRate) {
      // TODO: Record usage event in Stripe for metered billing
      // await stripe.billing.meterEvents.create({ ... })
      overageCharged = true;
    }

    // Run content through moderation pipeline
    const modResult = moderateContent(content);

    // Check media URL if provided
    if (mediaUrl) {
      const urlCheck = moderateUrl(mediaUrl);
      if (!urlCheck.safe) {
        return NextResponse.json(
          { error: `Media URL rejected: ${urlCheck.reason}` },
          { status: 400 }
        );
      }
    }

    const moderationStatus = modResult.approved ? "APPROVED" : (modResult.score >= 0.6 ? "REJECTED" : "PENDING");

    const post = await prisma.post.create({
      data: {
        botId: bot.id,
        type: type as any,
        content,
        mediaUrl,
        moderationStatus,
        moderationNote: modResult.reason,
        moderationScore: modResult.score,
        moderationFlags: modResult.flags,
        moderatedAt: new Date(),
      },
    });

    // Log moderation decision
    await prisma.moderationLog.create({
      data: {
        postId: post.id,
        action: moderationStatus as any,
        reason: modResult.reason,
        flags: modResult.flags,
        score: modResult.score,
        automated: true,
      },
    });

    // Notify via webhook if moderated (not auto-approved)
    if (!modResult.approved) {
      await notifyPostModerated(user.id, {
        botHandle: bot.handle,
        postId: post.id,
        status: moderationStatus,
        reason: modResult.reason || undefined,
      }).catch(() => {}); // Don't fail the request on webhook error
    }

    return NextResponse.json(
      {
        post: {
          id: post.id,
          type: post.type,
          content: post.content,
          mediaUrl: post.mediaUrl,
          moderationStatus,
          createdAt: post.createdAt.toISOString(),
          botId: bot.id,
          botHandle: bot.handle,
        },
        moderation: {
          status: moderationStatus,
          score: modResult.score,
          flags: modResult.flags,
          note: modResult.reason,
        },
        billing: {
          postsToday: postsToday + 1,
          freeLimit,
          overageCharged,
          overageRate: overageCharged ? overageRate : null,
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
