import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSeedImages } from "@/lib/character/generateSeed";
import { generateContextualAvatars } from "@/lib/character/generateAvatar";
import { generateRefPack } from "@/lib/character/generateRefPack";

/**
 * POST /api/admin/bots/:id/generate-images
 *
 * Generate seed images, avatar, and ref pack for a bot that doesn't have them.
 * Designed for seed bots that were created via the DB seed script (no wizard flow).
 *
 * Pipeline: seed images (4) → pick best → avatar (1) → ref pack (4)
 *
 * Query params:
 *   ?skip=seed    — skip seed generation (use existing characterSeedUrl)
 *   ?skip=avatar  — skip avatar generation
 *   ?skip=refpack — skip ref pack generation
 *   ?force=true   — regenerate even if images already exist
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const skip = searchParams.get("skip");
  const force = searchParams.get("force") === "true";

  const bot = await prisma.bot.findUnique({
    where: { id },
    select: {
      id: true,
      handle: true,
      name: true,
      bio: true,
      personality: true,
      niche: true,
      aesthetic: true,
      artStyle: true,
      contentStyle: true,
      botType: true,
      personaData: true,
      avatar: true,
      characterSeedUrl: true,
      characterRefPack: true,
    },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const results: Record<string, any> = {
    botId: bot.id,
    handle: bot.handle,
    steps: {},
  };

  // ── Step 1: Seed images ─────────────────────────────────────────────────
  let seedUrl = bot.characterSeedUrl;

  if (skip !== "seed" && (!seedUrl || force)) {
    try {
      // Build a character description from the bot's personality fields
      // since seed bots don't go through the wizard and have no appearance data
      const characterDescription = [
        bot.personality,
        bot.contentStyle ? `Content style: ${bot.contentStyle}` : "",
      ]
        .filter(Boolean)
        .join(". ");

      const seedUrls = await generateSeedImages({
        botId: bot.id,
        botType: (bot.botType as any) || "person",
        name: bot.name,
        niche: bot.niche || undefined,
        aesthetic: bot.aesthetic || undefined,
        characterDescription,
        count: 4,
      });

      if (seedUrls.length === 0) {
        return NextResponse.json(
          { error: "Seed image generation failed — no images returned" },
          { status: 502 }
        );
      }

      // Auto-select the first image as the seed
      seedUrl = seedUrls[0];
      await prisma.bot.update({
        where: { id: bot.id },
        data: { characterSeedUrl: seedUrl },
      });

      results.steps.seed = {
        status: "ok",
        count: seedUrls.length,
        selected: seedUrl,
        all: seedUrls,
      };
    } catch (err: any) {
      return NextResponse.json(
        { error: `Seed generation failed: ${err.message}` },
        { status: 502 }
      );
    }
  } else {
    results.steps.seed = {
      status: seedUrl ? "skipped (exists)" : "skipped (param)",
      existing: seedUrl,
    };
  }

  // Without a seed URL, avatar and ref pack can't be generated
  if (!seedUrl) {
    return NextResponse.json(
      { error: "No seed URL available — cannot generate avatar or ref pack" },
      { status: 422 }
    );
  }

  // ── Step 2: Avatar ──────────────────────────────────────────────────────
  if (skip !== "avatar" && (!bot.avatar || force)) {
    try {
      const avatarUrls = await generateContextualAvatars({
        botId: bot.id,
        name: bot.name,
        seedUrl,
        niche: bot.niche || undefined,
        aesthetic: bot.aesthetic || undefined,
        count: 1, // Just 1 for seed bots — no wizard to choose from
      });

      if (avatarUrls.length > 0) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { avatar: avatarUrls[0] },
        });
        results.steps.avatar = { status: "ok", url: avatarUrls[0] };
      } else {
        results.steps.avatar = { status: "failed", error: "No avatar returned" };
      }
    } catch (err: any) {
      results.steps.avatar = { status: "failed", error: err.message };
    }
  } else {
    results.steps.avatar = {
      status: bot.avatar ? "skipped (exists)" : "skipped (param)",
      existing: bot.avatar,
    };
  }

  // ── Step 3: Reference pack ──────────────────────────────────────────────
  if (skip !== "refpack" && (!bot.characterRefPack || force)) {
    try {
      const refPackUrls = await generateRefPack({
        botId: bot.id,
        name: bot.name,
        seedUrl,
        niche: bot.niche || undefined,
        personality: bot.personality || undefined,
        aesthetic: bot.aesthetic || undefined,
      });

      if (refPackUrls.length > 0) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { characterRefPack: refPackUrls },
        });
        results.steps.refpack = { status: "ok", count: refPackUrls.length, urls: refPackUrls };
      } else {
        results.steps.refpack = { status: "failed", error: "No ref pack images returned" };
      }
    } catch (err: any) {
      results.steps.refpack = { status: "failed", error: err.message };
    }
  } else {
    results.steps.refpack = {
      status: bot.characterRefPack ? "skipped (exists)" : "skipped (param)",
    };
  }

  return NextResponse.json(results);
}
