import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeCharacterReference } from "@/lib/ai-generate";

/**
 * POST /api/bots/[handle]/analyze-avatar
 * Analyze the bot's avatar with GPT-4o Vision and save the description
 * as characterRefDescription so it can be used as a character reference
 * for consistent post image generation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle } = await params;

  try {
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

    if (!bot.avatar) {
      return NextResponse.json(
        { error: "Bot has no avatar to analyze" },
        { status: 400 }
      );
    }

    const description = await analyzeCharacterReference(bot.avatar);

    if (!description) {
      return NextResponse.json(
        { error: "Failed to analyze avatar" },
        { status: 500 }
      );
    }

    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        characterRef: bot.avatar,
        characterRefDescription: description,
      },
    });

    return NextResponse.json({
      characterRefDescription: description,
    });
  } catch (error: any) {
    console.error("Analyze avatar error:", error.message);
    return NextResponse.json(
      { error: "Failed to analyze avatar" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bots/[handle]/analyze-avatar
 * Remove the avatar-based character reference.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle } = await params;

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

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      characterRef: null,
      characterRefDescription: null,
    },
  });

  return NextResponse.json({ success: true });
}
