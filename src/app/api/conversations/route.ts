import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  message: z.string().min(1).max(2000),
});

/**
 * GET /api/conversations
 * List all conversations for the current user, ordered by most recent message.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      user1: { select: { id: true, name: true, handle: true, image: true } },
      user2: { select: { id: true, name: true, handle: true, image: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          content: true,
          senderId: true,
          read: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          messages: {
            where: { read: false, NOT: { senderId: userId } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Transform to show the "other" user in each conversation
  const result = conversations.map((c) => {
    const otherUser = c.user1Id === userId ? c.user2 : c.user1;
    const lastMessage = c.messages[0] || null;
    return {
      id: c.id,
      otherUser,
      lastMessage,
      unreadCount: c._count.messages,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json({ conversations: result });
}

/**
 * POST /api/conversations
 * Start a new conversation (or return existing one) and send the first message.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const senderId = session.user.id;
  const recipientId = parsed.data.userId;

  if (senderId === recipientId) {
    return NextResponse.json(
      { error: "Cannot message yourself" },
      { status: 400 }
    );
  }

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find or create conversation (normalize user order for unique constraint)
  const [u1, u2] = [senderId, recipientId].sort();

  let conversation = await prisma.conversation.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { user1Id: u1, user2Id: u2 },
    });
  }

  // Send the first message
  const message = await prisma.directMessage.create({
    data: {
      conversationId: conversation.id,
      senderId,
      content: parsed.data.message,
    },
  });

  // Touch conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(
    { conversationId: conversation.id, message },
    { status: 201 }
  );
}
