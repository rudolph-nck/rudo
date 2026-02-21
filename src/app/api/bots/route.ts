import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAvatar } from "@/lib/ai-generate";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { z } from "zod";

// Relaxed schema — handle allows dots for admin-created seed bots.
// Non-admin users get a stricter check in the handler.
const createBotSchema = z.object({
  name: z.string().min(1).max(50),
  handle: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9_.]+$/, "Handle must be lowercase alphanumeric with underscores or dots"),
  bio: z.string().max(500).optional(),
  personality: z.string().max(5000).optional(),
  contentStyle: z.string().max(5000).optional(),
  niche: z.string().max(200).optional(),
  tone: z.string().max(200).optional(),
  aesthetic: z.string().max(200).optional(),
  artStyle: z.enum(["realistic", "cartoon", "anime", "3d_render", "watercolor", "pixel_art", "oil_painting", "comic_book"]).default("realistic"),
  botType: z.enum(["realistic", "fictional", "person", "character", "object", "ai_entity"]).default("realistic"),
  personaData: z.string().max(5000).optional(),
  isSeed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createBotSchema.safeParse(body);

    if (!parsed.success) {
      const e = parsed.error.errors[0];
      const field = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${field}${e.message}` },
        { status: 400 }
      );
    }

    // Enforce bot limits by tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true, role: true, _count: { select: { bots: true } } },
    });

    const isAdmin = user?.role === "ADMIN";

    // Non-admin users: strict handle format (no dots)
    if (!isAdmin && !/^[a-z0-9_]+$/.test(parsed.data.handle)) {
      return NextResponse.json(
        { error: "Handle must be lowercase alphanumeric with underscores" },
        { status: 400 }
      );
    }

    // Non-admin users: isSeed is not allowed
    if (!isAdmin && parsed.data.isSeed) {
      return NextResponse.json(
        { error: "Only admins can create seed bots" },
        { status: 403 }
      );
    }

    const botLimits: Record<string, number> = {
      FREE: 0,
      BYOB_FREE: 1,
      BYOB_PRO: 1,
      SPARK: 1,
      PULSE: 1,
      GRID: 3,
      ADMIN: 100,
    };

    const maxBots = botLimits[user?.tier || "FREE"] ?? 0;
    if ((user?._count.bots ?? 0) >= maxBots) {
      return NextResponse.json(
        { error: `Bot limit reached (${maxBots} for ${user?.tier} tier). Upgrade for more.` },
        { status: 403 }
      );
    }

    // Check handle uniqueness across both bots AND users
    const [existingBot, existingUser] = await Promise.all([
      prisma.bot.findUnique({ where: { handle: parsed.data.handle } }),
      prisma.user.findUnique({ where: { handle: parsed.data.handle } }),
    ]);

    if (existingBot || existingUser) {
      return NextResponse.json(
        { error: "Handle already taken" },
        { status: 409 }
      );
    }

    // Auto-verify bots for BYOB Pro and Grid tiers
    const verifiedTiers = ["BYOB_PRO", "GRID", "ADMIN"];
    const autoVerified = verifiedTiers.includes(user?.tier || "");

    const bot = await prisma.bot.create({
      data: {
        name: parsed.data.name,
        handle: parsed.data.handle,
        bio: parsed.data.bio,
        personality: parsed.data.personality,
        contentStyle: parsed.data.contentStyle,
        niche: parsed.data.niche,
        tone: parsed.data.tone,
        aesthetic: parsed.data.aesthetic,
        artStyle: parsed.data.artStyle,
        botType: parsed.data.botType,
        personaData: parsed.data.personaData,
        ownerId: session.user.id,
        isVerified: autoVerified,
        isSeed: isAdmin && parsed.data.isSeed ? true : false,
        isScheduled: isAdmin && parsed.data.isSeed ? true : false,
        postsPerDay: isAdmin && parsed.data.isSeed ? 2 : 1,
      },
    });

    // Auto-generate avatar for paid AI tiers (Spark+)
    // Runs async — bot is created immediately, avatar follows
    const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];
    if (aiTiers.includes(user?.tier || "")) {
      const botContext = {
        name: parsed.data.name,
        handle: parsed.data.handle,
        personality: parsed.data.personality || null,
        contentStyle: parsed.data.contentStyle || null,
        niche: parsed.data.niche || null,
        tone: parsed.data.tone || null,
        aesthetic: parsed.data.aesthetic || null,
        artStyle: parsed.data.artStyle || "realistic",
        bio: parsed.data.bio || null,
        avatar: null,
        characterRef: null,
        characterRefDescription: null,
        botType: parsed.data.botType || "realistic",
        personaData: parsed.data.personaData || null,
        characterSeedUrl: null,
        characterFaceUrl: null,
        characterRefPack: null,
        voiceId: null,
        contentRating: null,
        effectProfile: null,
      };

      // Fire-and-forget: don't block bot creation on image generation
      generateAvatar(botContext).then(async (avatarUrl) => {
        if (avatarUrl) {
          await prisma.bot.update({
            where: { id: bot.id },
            data: { avatar: avatarUrl },
          });
        }
      }).catch((err) => {
        console.error("Auto avatar generation failed:", err.message);
      });
    }

    // Enqueue welcome sequence for AI-tier bots (first-day workflow)
    if (aiTiers.includes(user?.tier || "")) {
      enqueueJob({
        type: "WELCOME_SEQUENCE",
        botId: bot.id,
        payload: { source: "bot_creation" },
      }).catch((err) => {
        console.error("Welcome sequence enqueue failed:", err.message);
      });
    }

    return NextResponse.json({ bot }, { status: 201 });
  } catch (error) {
    console.error("Create bot error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
