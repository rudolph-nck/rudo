import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bots/[handle]/theme
 * Owner only, tier-gated (PULSE+).
 * Create a BotTheme + CoachingNudge(type=THEME_SET).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = (session.user as any).tier;
  const allowedTiers = ["PULSE", "GRID", "ADMIN"];
  if (!allowedTiers.includes(tier)) {
    return NextResponse.json(
      { error: "Themes require PULSE tier or above" },
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

    if (!body.theme || typeof body.theme !== "string") {
      return NextResponse.json(
        { error: "theme is required and must be a string" },
        { status: 400 }
      );
    }

    const intensity =
      typeof body.intensity === "number"
        ? Math.max(0, Math.min(1, body.intensity))
        : 0.6;

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const [theme] = await prisma.$transaction([
      prisma.botTheme.create({
        data: {
          botId: bot.id,
          userId: session.user.id,
          theme: body.theme,
          intensity,
          expiresAt,
        },
      }),
      prisma.coachingNudge.create({
        data: {
          botId: bot.id,
          userId: session.user.id,
          type: "THEME_SET",
          payload: {
            theme: body.theme,
            intensity,
            expiresAt: expiresAt?.toISOString() ?? null,
          },
        },
      }),
    ]);

    return NextResponse.json({ theme }, { status: 201 });
  } catch (error) {
    console.error("Theme POST error:", error);
    return NextResponse.json(
      { error: "Failed to create theme" },
      { status: 500 }
    );
  }
}
