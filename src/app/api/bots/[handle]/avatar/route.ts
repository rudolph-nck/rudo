import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAvatar } from "@/lib/ai-generate";
import { generateContextualAvatars } from "@/lib/character";

/**
 * POST /api/bots/[handle]/avatar
 * Generate (or regenerate) avatar for a bot.
 * Uses InstantCharacter when a character seed exists, falls back to Flux.
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

  // Find the bot and verify ownership
  const bot = await prisma.bot.findUnique({
    where: { handle },
    include: { owner: { select: { id: true, tier: true } } },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  if (bot.owner.id !== session.user.id) {
    return NextResponse.json({ error: "Not your bot" }, { status: 403 });
  }

  // AI generation requires Spark+ tier
  const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];
  if (!aiTiers.includes(bot.owner.tier)) {
    return NextResponse.json(
      { error: "AI avatar generation requires Spark tier or higher" },
      { status: 403 }
    );
  }

  try {
    let avatarUrl: string | null = null;

    // Use InstantCharacter when a character seed exists for identity consistency
    if (bot.characterSeedUrl) {
      const urls = await generateContextualAvatars({
        botId: bot.id,
        name: bot.name,
        seedUrl: bot.characterSeedUrl,
        niche: bot.niche || undefined,
        aesthetic: bot.aesthetic || undefined,
        count: 1,
      });
      avatarUrl = urls[0] || null;
    }

    // Fall back to generic Flux avatar if no seed or InstantCharacter failed
    if (!avatarUrl) {
      avatarUrl = await generateAvatar({
        name: bot.name,
        handle: bot.handle,
        personality: bot.personality,
        contentStyle: bot.contentStyle,
        niche: bot.niche,
        tone: bot.tone,
        aesthetic: bot.aesthetic,
        artStyle: bot.artStyle,
        bio: bot.bio,
        avatar: bot.avatar,
        characterRef: bot.characterRef,
        characterRefDescription: bot.characterRefDescription,
        botType: bot.botType,
        personaData: bot.personaData,
        characterSeedUrl: bot.characterSeedUrl,
        characterFaceUrl: bot.characterFaceUrl,
        characterRefPack: bot.characterRefPack as any,
        voiceId: bot.voiceId,
        contentRating: bot.contentRating,
        effectProfile: bot.effectProfile,
      });
    }

    if (avatarUrl) {
      await prisma.bot.update({
        where: { id: bot.id },
        data: { avatar: avatarUrl },
      });
    }

    return NextResponse.json({ avatar: avatarUrl });
  } catch (error: any) {
    console.error("Avatar generation error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate avatar" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bots/[handle]/avatar
 * Manually set avatar or banner URL (for user uploads).
 * Available to all tiers.
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

  try {
    const body = await req.json();
    const updateData: Record<string, string | null> = {};

    if (typeof body.avatar === "string") {
      updateData.avatar = body.avatar || null;
    }
    if (typeof body.banner === "string") {
      updateData.banner = body.banner || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Provide avatar and/or banner URL" },
        { status: 400 }
      );
    }

    await prisma.bot.update({
      where: { id: bot.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, ...updateData });
  } catch (error: any) {
    console.error("Avatar upload error:", error.message);
    return NextResponse.json(
      { error: "Failed to update avatar/banner" },
      { status: 500 }
    );
  }
}
