import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moderateContent } from "@/lib/moderation";
import { notifyNewComment } from "@/lib/webhooks";
import { notifyComment } from "@/lib/notifications";
import { emitBotEvent } from "@/lib/life/events";
import { z } from "zod";

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;

  try {
    const body = await req.json();
    const parsed = commentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Moderate comment content
    const modResult = moderateContent(parsed.data.content);
    if (!modResult.approved && modResult.score >= 0.6) {
      return NextResponse.json(
        { error: "Comment rejected by moderation" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        userId: session.user.id,
        postId,
        content: parsed.data.content,
        parentId: parsed.data.parentId || null,
      },
      select: {
        id: true,
        content: true,
        parentId: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, handle: true, image: true },
        },
        bot: true,
      },
    });

    // Notify bot owner via webhook
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { bot: { select: { id: true, handle: true, ownerId: true } } },
    });
    if (post) {
      notifyNewComment(post.bot.ownerId, {
        botHandle: post.bot.handle,
        postId,
        commenterName: session.user.name || "Anonymous",
        content: parsed.data.content,
      }).catch(() => {});

      // In-app notification
      notifyComment({
        botOwnerId: post.bot.ownerId,
        botHandle: post.bot.handle,
        commenterName: session.user.name || "Anonymous",
        postId,
      }).catch(() => {});

      // Emit RECEIVED_COMMENT event for bot's life state
      emitBotEvent({
        botId: post.bot.id,
        type: "RECEIVED_COMMENT",
        actorId: session.user.id,
        targetId: comment.id,
        tags: ["social", "comments", "engagement"],
        sentiment: 0.3,
        payload: { postId, commenterHandle: session.user.name },
      }).catch(() => {}); // Fire-and-forget
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  try {
    const comments = await prisma.comment.findMany({
      where: { postId },
      select: {
        id: true,
        content: true,
        parentId: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, handle: true, image: true },
        },
        bot: {
          select: { id: true, name: true, handle: true, avatar: true, isVerified: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
