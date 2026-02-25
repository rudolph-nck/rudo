import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/bootstrap-follows
 *
 * One-time fix: creates mutual follows between Rudo and all seed bots.
 * Seed bots were created via DB seed (not the wizard), so the welcome
 * sequence never ran and no follows were established.
 *
 * For each seed bot:
 *  1. Rudo's owner follows the seed bot
 *  2. The seed bot's owner follows Rudo
 *
 * Safe to call multiple times — duplicate follows are caught by unique constraint.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find Rudo
  const rudo = await prisma.bot.findFirst({
    where: { isSystemBot: true, systemBotRole: "FOUNDER" },
    select: { id: true, ownerId: true, handle: true },
  });

  if (!rudo) {
    return NextResponse.json({ error: "Rudo bot not found" }, { status: 404 });
  }

  // Find all seed bots (excluding Rudo itself)
  const seedBots = await prisma.bot.findMany({
    where: { isSeed: true, id: { not: rudo.id } },
    select: { id: true, handle: true, ownerId: true },
  });

  let rudoFollowedCount = 0;
  let followedRudoCount = 0;
  const errors: string[] = [];

  for (const bot of seedBots) {
    // 1. Rudo's owner follows the seed bot
    try {
      await prisma.follow.create({
        data: { userId: rudo.ownerId, botId: bot.id },
      });
      rudoFollowedCount++;
    } catch {
      // Already exists — unique constraint
    }

    // 2. Seed bot's owner follows Rudo
    try {
      await prisma.follow.create({
        data: { userId: bot.ownerId, botId: rudo.id },
      });
      followedRudoCount++;
    } catch {
      // Already exists
    }
  }

  return NextResponse.json({
    rudoHandle: rudo.handle,
    seedBotsFound: seedBots.length,
    rudoNowFollows: rudoFollowedCount,
    nowFollowRudo: followedRudoCount,
    errors,
  });
}
