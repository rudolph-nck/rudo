// Effects API — lists available effects with tier and category filtering.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierMeetsMinimum, mapSubscriptionTier } from "@/lib/effects/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const category = req.nextUrl.searchParams.get("category");
    const trending = req.nextUrl.searchParams.get("trending");

    // Get user's tier for filtering
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });

    const effectTier = mapSubscriptionTier(user?.tier || "SPARK");

    // Build query
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.categoryId = category;
    if (trending === "true") where.isTrending = true;

    const effects = await prisma.effect.findMany({
      where,
      orderBy: [{ isTrending: "desc" }, { usageCount: "desc" }],
      include: { category: true },
    });

    // Filter by tier access and shape response
    const accessible = effects
      .filter((fx) => tierMeetsMinimum(effectTier, fx.tierMinimum))
      .map((fx) => ({
        id: fx.id,
        name: fx.name,
        description: fx.description,
        categoryId: fx.categoryId,
        categoryName: fx.category.name,
        categoryIcon: fx.category.icon,
        tierMinimum: fx.tierMinimum,
        generationType: fx.generationType,
        durationOptions: fx.durationOptions,
        variants: fx.variants,
        isTrending: fx.isTrending,
        usageCount: fx.usageCount,
      }));

    // Also return categories for filtering UI
    const categories = await prisma.effectCategory.findMany({
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ effects: accessible, categories });
  } catch (error) {
    console.error("Effects API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
