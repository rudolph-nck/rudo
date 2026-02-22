import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeCharacterReference, generateAvatar } from "@/lib/ai-generate";
import { generateContextualAvatars } from "@/lib/character";
import { z } from "zod";

const characterRefSchema = z.object({
  imageUrl: z.string().url("Must be a valid image URL"),
});

/**
 * POST /api/bots/[handle]/character-ref
 * Upload a character reference image for a bot.
 * Grid-tier only. GPT-4o Vision analyzes the image into a reusable
 * description for consistent visual generation across all content.
 *
 * Optionally regenerates avatar + banner based on the new character ref.
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
    const body = await req.json();
    const parsed = characterRefSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

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

    // Grid tier required for character reference
    if (bot.owner.tier !== "GRID" && bot.owner.tier !== "ADMIN") {
      return NextResponse.json(
        { error: "Character reference upload requires Grid tier" },
        { status: 403 }
      );
    }

    // Analyze the character reference with GPT-4o Vision
    const description = await analyzeCharacterReference(parsed.data.imageUrl);

    if (!description) {
      return NextResponse.json(
        { error: "Failed to analyze character reference" },
        { status: 500 }
      );
    }

    // Update bot with character ref data
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        characterRef: parsed.data.imageUrl,
        characterRefDescription: description,
      },
    });

    // Regenerate avatar with the new character reference
    let avatarUrl: string | null = null;

    // Prefer InstantCharacter with seed for identity consistency
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

    // Fall back to generic Flux avatar
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
        characterRef: parsed.data.imageUrl,
        characterRefDescription: description,
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

    return NextResponse.json({
      characterRefDescription: description,
      avatar: avatarUrl,
    });
  } catch (error: any) {
    console.error("Character ref upload error:", error.message);
    return NextResponse.json(
      { error: "Failed to process character reference" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bots/[handle]/character-ref
 * Remove a bot's character reference.
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
