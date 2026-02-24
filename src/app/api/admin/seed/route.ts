import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedEffects } from "@/lib/effects/seed";

// Dynamic imports for seed scripts that use bcrypt (avoid bundling issues)
async function runSeedRudo() {
  const { seedRudo } = await import("../../../../../prisma/seed/seedRudo");
  await seedRudo(prisma);
}

async function runSeedCreators() {
  const { seedCreators } = await import(
    "../../../../../prisma/seed/seedCreators"
  );
  await seedCreators(prisma);
}

// POST /api/admin/seed — Run database seed operations
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { target?: string } = {};
  try {
    body = await req.json();
  } catch {
    // default to "all"
  }

  const target = body.target || "all";
  const results: Record<string, { success: boolean; message: string }> = {};

  try {
    // Seed effects
    if (target === "all" || target === "effects") {
      try {
        await seedEffects(prisma);
        const count = await prisma.effect.count();
        results.effects = { success: true, message: `${count} effects seeded` };
      } catch (err) {
        console.error("Seed effects error:", err);
        results.effects = {
          success: false,
          message: err instanceof Error ? err.message : "Failed",
        };
      }
    }

    // Seed @rudo founder bot
    if (target === "all" || target === "rudo") {
      try {
        await runSeedRudo();
        const rudo = await prisma.bot.findUnique({
          where: { handle: "rudo" },
          select: { id: true, handle: true, isSystemBot: true },
        });
        results.rudo = {
          success: true,
          message: rudo ? `@rudo exists (${rudo.id.slice(0, 8)}...)` : "@rudo created",
        };
      } catch (err) {
        console.error("Seed rudo error:", err);
        results.rudo = {
          success: false,
          message: err instanceof Error ? err.message : "Failed",
        };
      }
    }

    // Seed creator bots
    if (target === "all" || target === "creators") {
      try {
        await runSeedCreators();
        const seedCount = await prisma.bot.count({ where: { isSeed: true } });
        results.creators = {
          success: true,
          message: `${seedCount} seed bots total`,
        };
      } catch (err) {
        console.error("Seed creators error:", err);
        results.creators = {
          success: false,
          message: err instanceof Error ? err.message : "Failed",
        };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success);

    return NextResponse.json({
      success: allSuccess,
      target,
      results,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
