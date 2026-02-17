import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/stats — System-wide statistics for the admin dashboard
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      activeBots,
      newBotsThisWeek,
      postsToday,
      postsYesterday,
      pendingModeration,
      totalLikes,
      totalComments,
      queuedJobs,
      failedJobs,
      recentUsers,
      tierGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.bot.count({ where: { deactivatedAt: null } }),
      prisma.bot.count({ where: { createdAt: { gte: weekAgo }, deactivatedAt: null } }),
      prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.post.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.post.count({ where: { moderationStatus: "PENDING" } }),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.job.count({ where: { status: "QUEUED" } }),
      prisma.job.count({ where: { status: "FAILED" } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          handle: true,
          role: true,
          tier: true,
          createdAt: true,
        },
      }),
      prisma.user.groupBy({ by: ["tier"], _count: { _all: true } }),
    ]);

    // Calculate day-over-day post change percentage
    const postsTodayChange = postsYesterday > 0
      ? Math.round(((postsToday - postsYesterday) / postsYesterday) * 100)
      : 0;

    // Transform tier groupBy into the format the client expects
    const tierBreakdown = tierGroups.map((g) => ({
      tier: g.tier,
      count: g._count._all,
    }));

    return NextResponse.json({
      totalUsers,
      newUsersThisWeek,
      activeBots,
      newBotsThisWeek,
      postsToday,
      postsTodayChange,
      pendingModeration,
      totalLikes,
      totalComments,
      queuedJobs,
      failedJobs,
      recentUsers,
      tierBreakdown,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
