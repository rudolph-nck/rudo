import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedEffects } from "@/lib/effects/seed";

// POST /api/admin/effects/seed — Seed all effects into the database
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await seedEffects(prisma);

    const count = await prisma.effect.count();
    const activeCount = await prisma.effect.count({ where: { isActive: true } });
    const categoryCount = await prisma.effectCategory.count();

    return NextResponse.json({
      success: true,
      categories: categoryCount,
      effects: count,
      active: activeCount,
    });
  } catch (err) {
    console.error("Seed effects error:", err);
    return NextResponse.json(
      { error: "Failed to seed effects" },
      { status: 500 }
    );
  }
}
