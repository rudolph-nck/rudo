import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureBrain } from "@/lib/brain/ensure";
import { validateBrain } from "@/lib/brain/schema";

/**
 * GET /api/bots/[handle]/brain
 * Return the bot's characterBrain. Owner only.
 * If no brain exists, compile one using ensureBrain.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle } = await params;

  try {
    const bot = await prisma.bot.findUnique({ where: { handle } });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }
    if (bot.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const brain = await ensureBrain(bot.id);

    return NextResponse.json({ brain });
  } catch (error) {
    console.error("Brain GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bots/[handle]/brain
 * Owner only, tier-gated (PULSE+).
 * Accept partial brain updates, merge with existing, validate, persist.
 * Also writes a CoachingNudge with type SLIDER_UPDATE.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = (session.user as any).tier;
  const writeTiers = ["PULSE", "GRID", "ADMIN"];
  if (!writeTiers.includes(tier)) {
    return NextResponse.json(
      { error: "Brain editing requires PULSE tier or above" },
      { status: 403 }
    );
  }

  const { handle } = await params;

  try {
    const bot = await prisma.bot.findUnique({ where: { handle } });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }
    if (bot.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Get existing brain (or compile one)
    const existing = await ensureBrain(bot.id);

    // Deep-merge partial updates into existing brain
    const merged = {
      ...existing,
      traits: { ...existing.traits, ...(body.traits ?? {}) },
      style: { ...existing.style, ...(body.style ?? {}) },
      contentBias: {
        ...existing.contentBias,
        ...(body.contentBias ?? {}),
        pillars: {
          ...existing.contentBias.pillars,
          ...(body.contentBias?.pillars ?? {}),
        },
      },
      safeguards: { ...existing.safeguards, ...(body.safeguards ?? {}) },
    };

    // Validate merged brain
    let validated;
    try {
      validated = validateBrain(merged);
    } catch (validationError) {
      return NextResponse.json(
        { error: "Invalid brain data", details: String(validationError) },
        { status: 400 }
      );
    }

    // Persist brain + nudge in a transaction
    const [updated] = await prisma.$transaction([
      prisma.bot.update({
        where: { id: bot.id },
        data: {
          characterBrain: validated as any,
          brainUpdatedAt: new Date(),
        },
      }),
      prisma.coachingNudge.create({
        data: {
          botId: bot.id,
          userId: session.user.id,
          type: "SLIDER_UPDATE",
          payload: body,
        },
      }),
    ]);

    return NextResponse.json({ brain: validated });
  } catch (error) {
    console.error("Brain PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update brain" },
      { status: 500 }
    );
  }
}
