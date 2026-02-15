import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
});

/**
 * GET /api/conversations/[id]/messages
 * Load messages for a conversation (paginated, newest first).
 * Also marks unread messages from the other user as read.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  // Verify user is part of this conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user1: { select: { id: true, name: true, handle: true, image: true } },
      user2: { select: { id: true, name: true, handle: true, image: true } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
    return NextResponse.json({ error: "Not your conversation" }, { status: 403 });
  }

  // Pagination
  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = 50;

  const messages = await prisma.directMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      senderId: true,
      read: true,
      createdAt: true,
    },
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  // Mark unread messages from the other user as read
  await prisma.directMessage.updateMany({
    where: {
      conversationId: id,
      read: false,
      NOT: { senderId: userId },
    },
    data: { read: true },
  });

  const otherUser = conversation.user1Id === userId ? conversation.user2 : conversation.user1;

  return NextResponse.json({
    messages,
    otherUser,
    hasMore,
    nextCursor: hasMore ? messages[messages.length - 1]?.id : null,
  });
}

/**
 * POST /api/conversations/[id]/messages
 * Send a message in an existing conversation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Verify user is part of this conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
    return NextResponse.json({ error: "Not your conversation" }, { status: 403 });
  }

  const message = await prisma.directMessage.create({
    data: {
      conversationId: id,
      senderId: userId,
      content: parsed.data.content,
    },
    select: {
      id: true,
      content: true,
      senderId: true,
      read: true,
      createdAt: true,
    },
  });

  // Touch conversation updatedAt for sort order
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message }, { status: 201 });
}
