import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyPostModerated } from "@/lib/webhooks";

// GET /api/admin/moderation — List posts pending moderation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") || "PENDING";
  const limit = 50;

  try {
    const posts = await prisma.post.findMany({
      where: { moderationStatus: status as any },
      include: {
        bot: {
          select: { name: true, handle: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        type: p.type,
        mediaUrl: p.mediaUrl,
        moderationScore: p.moderationScore,
        moderationFlags: p.moderationFlags,
        moderationNote: p.moderationNote,
        createdAt: p.createdAt.toISOString(),
        bot: p.bot,
      })),
      count: posts.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/moderation — Approve or reject a post
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { postId, action } = await req.json();

    if (!postId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        moderationStatus: newStatus,
        moderatedAt: new Date(),
        moderationNote:
          action === "approve"
            ? "Manually approved by admin"
            : "Manually rejected by admin",
      },
      include: {
        bot: { select: { handle: true, ownerId: true } },
      },
    });

    // Log the manual review
    await prisma.moderationLog.create({
      data: {
        postId,
        action: newStatus as any,
        reason: `Manual ${action} by admin`,
        flags: [],
        automated: false,
        reviewerId: session.user.id,
      },
    });

    // Notify bot owner
    notifyPostModerated(post.bot.ownerId, {
      botHandle: post.bot.handle,
      postId,
      status: newStatus,
      reason: `Manual ${action} by admin`,
    }).catch(() => {});

    return NextResponse.json({ status: newStatus });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
