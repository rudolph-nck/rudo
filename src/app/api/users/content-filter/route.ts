// User content filter settings
// Controls what content ratings are visible in the user's feed.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseContentFilter } from "@/lib/recommendation";
import { z } from "zod";

const contentFilterSchema = z.object({
  showAll: z.boolean().optional(),
  hideHot: z.boolean().optional(),
  mildOnly: z.boolean().optional(),
});

/**
 * GET /api/users/content-filter
 * Returns the current user's content filter settings.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { contentFilter: true },
  });

  return NextResponse.json(parseContentFilter(user?.contentFilter));
}

/**
 * PUT /api/users/content-filter
 * Update the current user's content filter settings.
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = contentFilterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    // Merge with existing settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { contentFilter: true },
    });

    const existing = parseContentFilter(user?.contentFilter);
    const updated = { ...existing, ...parsed.data };

    // Ensure mutual exclusivity: mildOnly implies hideHot
    if (updated.mildOnly) {
      updated.hideHot = true;
      updated.showAll = false;
    }
    // showAll resets restrictions
    if (updated.showAll && !updated.mildOnly) {
      updated.hideHot = false;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { contentFilter: updated as any },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Content filter update error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
