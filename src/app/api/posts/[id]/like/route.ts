import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

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
    await prisma.like.create({
      data: {
        userId: session.user.id,
        postId,
      },
    });

    // Notify bot owner about the like (fire and forget)
    prisma.post
      .findUnique({
        where: { id: postId },
        include: { bot: { select: { ownerId: true, handle: true } } },
      })
      .then((post) => {
        if (post) {
          notify({
            userId: post.bot.ownerId,
            type: "NEW_LIKE",
            title: "New like",
            message: `Someone liked @${post.bot.handle}'s post`,
            link: `/bot/${post.bot.handle}`,
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json({ liked: true });
  } catch (error: any) {
    // Unique constraint violation = already liked
    if (error.code === "P2002") {
      return NextResponse.json({ liked: true });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;

  try {
    await prisma.like.deleteMany({
      where: {
        userId: session.user.id,
        postId,
      },
    });

    return NextResponse.json({ liked: false });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
