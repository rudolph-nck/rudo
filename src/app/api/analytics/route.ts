import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Get user's bots
    const bots = await prisma.bot.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, handle: true, isVerified: true },
    });

    const botIds = bots.map((b) => b.id);

    if (botIds.length === 0) {
      return NextResponse.json({
        bots: [],
        totals: {
          followers: 0, views: 0, likes: 0, comments: 0,
          engagementRate: 0, postsThisWeek: 0,
        },
        daily: [],
        topPosts: [],
        trend: "neutral",
      });
    }

    // Aggregate follower counts
    const totalFollowers = await prisma.follow.count({
      where: { botId: { in: botIds } },
    });

    // Posts from last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPosts = await prisma.post.findMany({
      where: {
        botId: { in: botIds },
        moderationStatus: "APPROVED",
        createdAt: { gte: weekAgo },
      },
      include: {
        bot: { select: { name: true, handle: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalViews = recentPosts.reduce((s, p) => s + p.viewCount, 0);
    const totalLikes = recentPosts.reduce((s, p) => s + p._count.likes, 0);
    const totalComments = recentPosts.reduce((s, p) => s + p._count.comments, 0);
    const engagementRate = totalViews > 0
      ? Math.round(((totalLikes + totalComments) / totalViews) * 10000) / 100
      : 0;

    // Previous week for trend comparison
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const prevPosts = await prisma.post.findMany({
      where: {
        botId: { in: botIds },
        moderationStatus: "APPROVED",
        createdAt: { gte: twoWeeksAgo, lt: weekAgo },
      },
      include: { _count: { select: { likes: true, comments: true } } },
    });

    const prevEngagement = prevPosts.reduce(
      (s, p) => s + p._count.likes + p._count.comments, 0
    );
    const currentEngagement = totalLikes + totalComments;
    const trend = currentEngagement > prevEngagement * 1.1
      ? "up"
      : currentEngagement < prevEngagement * 0.9
        ? "down"
        : "neutral";

    // Daily breakdown (last 7 days)
    const daily: { date: string; views: number; likes: number; comments: number; posts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayPosts = recentPosts.filter(
        (p) => p.createdAt >= dayStart && p.createdAt < dayEnd
      );

      daily.push({
        date: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
        views: dayPosts.reduce((s, p) => s + p.viewCount, 0),
        likes: dayPosts.reduce((s, p) => s + p._count.likes, 0),
        comments: dayPosts.reduce((s, p) => s + p._count.comments, 0),
        posts: dayPosts.length,
      });
    }

    // Top 5 posts by engagement
    const topPosts = [...recentPosts]
      .sort((a, b) => {
        const aScore = a._count.likes + a._count.comments * 2.5;
        const bScore = b._count.likes + b._count.comments * 2.5;
        return bScore - aScore;
      })
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        content: p.content.slice(0, 100),
        botHandle: p.bot.handle,
        botName: p.bot.name,
        likes: p._count.likes,
        comments: p._count.comments,
        views: p.viewCount,
      }));

    return NextResponse.json({
      bots,
      totals: {
        followers: totalFollowers,
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        engagementRate,
        postsThisWeek: recentPosts.length,
      },
      daily,
      topPosts,
      trend,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
