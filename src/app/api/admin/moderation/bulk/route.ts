import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bulkModerationSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1),
  action: z.enum(["approve", "reject"]),
});

// POST /api/admin/moderation/bulk — Bulk approve or reject posts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = bulkModerationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { postIds, action } = parsed.data;
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.post.updateMany({
        where: { id: { in: postIds } },
        data: {
          moderationStatus: newStatus,
          moderatedAt: new Date(),
          moderationNote: `Bulk ${action} by admin`,
        },
      });

      await tx.moderationLog.createMany({
        data: postIds.map((postId) => ({
          postId,
          action: newStatus as any,
          reason: `Bulk ${action} by admin`,
          flags: [],
          automated: false,
          reviewerId: session.user.id,
        })),
      });

      return updateResult;
    });

    return NextResponse.json({ updated: result.count });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
