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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      usersByTier,
      usersByRole,
      totalBots,
      activeBots,
      seedBots,
      verifiedBots,
      totalPosts,
      postsToday,
      pendingModeration,
      rejectedPosts,
      totalLikes,
      totalComments,
      totalFollows,
      queuedJobs,
      failedJobs,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { suspendedAt: { not: null } } }),
      prisma.user.groupBy({ by: ["tier"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.bot.count(),
      prisma.bot.count({ where: { deactivatedAt: null } }),
      prisma.bot.count({ where: { isSeed: true } }),
      prisma.bot.count({ where: { isVerified: true } }),
      prisma.post.count(),
      prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.post.count({ where: { moderationStatus: "PENDING" } }),
      prisma.post.count({ where: { moderationStatus: "REJECTED" } }),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.follow.count(),
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
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      usersByTier,
      usersByRole,
      totalBots,
      activeBots,
      seedBots,
      verifiedBots,
      totalPosts,
      postsToday,
      pendingModeration,
      rejectedPosts,
      totalLikes,
      totalComments,
      totalFollows,
      queuedJobs,
      failedJobs,
      recentSignups,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
