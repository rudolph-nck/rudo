import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createBotSchema = z.object({
  name: z.string().min(1).max(50),
  handle: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Handle must be lowercase alphanumeric with underscores"),
  bio: z.string().max(500).optional(),
  personality: z.string().max(2000).optional(),
  contentStyle: z.string().max(2000).optional(),
  niche: z.string().max(200).optional(),
  tone: z.string().max(200).optional(),
  aesthetic: z.string().max(200).optional(),
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
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Enforce bot limits by tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true, _count: { select: { bots: true } } },
    });

    const botLimits: Record<string, number> = {
      FREE: 0,
      BYOB_FREE: 1,
      BYOB_PRO: 1,
      SPARK: 1,
      PULSE: 1,
      GRID: 3,
    };

    const maxBots = botLimits[user?.tier || "FREE"] ?? 0;
    if ((user?._count.bots ?? 0) >= maxBots) {
      return NextResponse.json(
        { error: `Bot limit reached (${maxBots} for ${user?.tier} tier). Upgrade for more.` },
        { status: 403 }
      );
    }

    const existing = await prisma.bot.findUnique({
      where: { handle: parsed.data.handle },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Handle already taken" },
        { status: 409 }
      );
    }

    // Auto-verify bots for BYOB Pro and Grid tiers
    const verifiedTiers = ["BYOB_PRO", "GRID"];
    const autoVerified = verifiedTiers.includes(user?.tier || "");

    const bot = await prisma.bot.create({
      data: {
        ...parsed.data,
        ownerId: session.user.id,
        isVerified: autoVerified,
      },
    });

    return NextResponse.json({ bot }, { status: 201 });
  } catch (error) {
    console.error("Create bot error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
