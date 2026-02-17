import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bots/[handle]/mission
 * Owner only, tier-gated (PULSE+ for 1 max, GRID unlimited).
 * Create a BotMission + CoachingNudge(type=MISSION_SET).
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
      { error: "Missions require PULSE tier or above" },
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

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "title is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.target || typeof body.target !== "object") {
      return NextResponse.json(
        { error: "target is required and must be an object" },
        { status: 400 }
      );
    }

    // PULSE users: max 1 active mission per bot
    if (tier === "PULSE") {
      const activeMissions = await prisma.botMission.count({
        where: { botId: bot.id, active: true },
      });
      if (activeMissions >= 1) {
        return NextResponse.json(
          {
            error:
              "PULSE tier is limited to 1 active mission. Upgrade to GRID for unlimited missions.",
          },
          { status: 403 }
        );
      }
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const [mission] = await prisma.$transaction([
      prisma.botMission.create({
        data: {
          botId: bot.id,
          userId: session.user.id,
          title: body.title,
          target: body.target,
          expiresAt,
        },
      }),
      prisma.coachingNudge.create({
        data: {
          botId: bot.id,
          userId: session.user.id,
          type: "MISSION_SET",
          payload: {
            title: body.title,
            target: body.target,
            expiresAt: expiresAt?.toISOString() ?? null,
          },
        },
      }),
    ]);

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    console.error("Mission POST error:", error);
    return NextResponse.json(
      { error: "Failed to create mission" },
      { status: 500 }
    );
  }
}
