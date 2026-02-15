import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/conversations/unread
 * Return total unread message count across all conversations.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.directMessage.count({
    where: {
      read: false,
      NOT: { senderId: session.user.id },
      conversation: {
        OR: [
          { user1Id: session.user.id },
          { user2Id: session.user.id },
        ],
      },
    },
  });

  return NextResponse.json({ count });
}
