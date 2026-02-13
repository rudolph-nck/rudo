import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAvatar, generateBanner } from "@/lib/ai-generate";
import { persistImage } from "@/lib/media";

/**
 * POST /api/bots/[handle]/avatar
 * Generate (or regenerate) avatar and/or banner for a bot using DALL-E 3.
 * Spark+ tiers can AI-generate. All tiers can manually upload (handled separately via media upload).
 *
 * Query params:
 *   ?type=avatar  — generate avatar only
 *   ?type=banner  — generate banner only
 *   ?type=both    — generate both (default)
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
  const genType = req.nextUrl.searchParams.get("type") || "both";

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
  const aiTiers = ["SPARK", "PULSE", "GRID"];
  if (!aiTiers.includes(bot.owner.tier)) {
    return NextResponse.json(
      { error: "AI avatar generation requires Spark tier or higher" },
      { status: 403 }
    );
  }

  const botContext = {
    name: bot.name,
    handle: bot.handle,
    personality: bot.personality,
    contentStyle: bot.contentStyle,
    niche: bot.niche,
    tone: bot.tone,
    aesthetic: bot.aesthetic,
    bio: bot.bio,
    characterRef: bot.characterRef,
    characterRefDescription: bot.characterRefDescription,
  };

  try {
    let avatarUrl: string | null = null;
    let bannerUrl: string | null = null;

    if (genType === "avatar" || genType === "both") {
      avatarUrl = await generateAvatar(botContext);
    }

    if (genType === "banner" || genType === "both") {
      bannerUrl = await generateBanner(botContext);
    }

    // Persist DALL-E images to S3 before URLs expire (~1 hour)
    if (avatarUrl) {
      try {
        avatarUrl = await persistImage(avatarUrl, `bots/${bot.id}/avatars`);
      } catch (err: any) {
        console.error("Failed to persist avatar to S3:", err.message);
      }
    }
    if (bannerUrl) {
      try {
        bannerUrl = await persistImage(bannerUrl, `bots/${bot.id}/banners`);
      } catch (err: any) {
        console.error("Failed to persist banner to S3:", err.message);
      }
    }

    // Update bot with persistent image URLs
    const updateData: Record<string, string> = {};
    if (avatarUrl) updateData.avatar = avatarUrl;
    if (bannerUrl) updateData.banner = bannerUrl;

    if (Object.keys(updateData).length > 0) {
      await prisma.bot.update({
        where: { id: bot.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      avatar: avatarUrl,
      banner: bannerUrl,
    });
  } catch (error: any) {
    console.error("Avatar/banner generation error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate avatar/banner" },
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
