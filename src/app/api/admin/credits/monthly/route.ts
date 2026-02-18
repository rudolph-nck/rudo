import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// GET /api/admin/credits/monthly — Month-over-month spending comparison
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const monthCount = parseInt(searchParams.get("months") || "6");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Build list of months to query
    const monthsToQuery: { year: number; month: number }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      monthsToQuery.push({ year: y, month: m });
    }

    // Get stored summaries
    const summaries = await prisma.monthlySpendingSummary.findMany({
      where: {
        OR: monthsToQuery.map((mq) => ({
          year: mq.year,
          month: mq.month,
        })),
      },
      include: {
        provider: { select: { providerName: true, displayName: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    // Also calculate from live data for the current month (may not be aggregated yet)
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
    const liveCurrentMonth = await prisma.apiUsageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfCurrentMonth } },
      _sum: { costUsd: true },
      _count: { _all: true },
    });

    // Group summaries by month
    const monthData = monthsToQuery.map((mq) => {
      const isCurrentMonth =
        mq.year === currentYear && mq.month === currentMonth;
      const monthSummaries = summaries.filter(
        (s) => s.year === mq.year && s.month === mq.month
      );

      let totalSpent: number;
      let totalCalls: number;
      let providers: { name: string; spent: number; calls: number }[];

      if (isCurrentMonth && liveCurrentMonth.length > 0) {
        // Use live data for current month
        totalSpent = liveCurrentMonth.reduce(
          (sum, l) => sum + Number(l._sum.costUsd || 0),
          0
        );
        totalCalls = liveCurrentMonth.reduce(
          (sum, l) => sum + l._count._all,
          0
        );
        providers = liveCurrentMonth.map((l) => ({
          name: `provider-${l.providerId}`,
          spent: Number(l._sum.costUsd || 0),
          calls: l._count._all,
        }));
      } else {
        totalSpent = monthSummaries.reduce(
          (sum, s) => sum + Number(s.totalCostUsd),
          0
        );
        totalCalls = monthSummaries.reduce(
          (sum, s) => sum + s.totalApiCalls,
          0
        );
        providers = monthSummaries.map((s) => ({
          name: s.provider.displayName,
          spent: Number(s.totalCostUsd),
          calls: s.totalApiCalls,
        }));
      }

      return {
        year: mq.year,
        month: mq.month,
        label: `${MONTH_NAMES[mq.month - 1]} ${mq.year}`,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalCalls,
        avgCostPerCall:
          totalCalls > 0
            ? Math.round((totalSpent / totalCalls) * 100) / 100
            : 0,
        providers,
      };
    });

    // Add change percentages
    const months = monthData.map((m, i) => {
      const prev = i > 0 ? monthData[i - 1] : null;
      return {
        ...m,
        changeFromPrevious: prev
          ? Math.round((m.totalSpent - prev.totalSpent) * 100) / 100
          : null,
        changePercent:
          prev && prev.totalSpent > 0
            ? Math.round(
                ((m.totalSpent - prev.totalSpent) / prev.totalSpent) * 1000
              ) / 10
            : null,
      };
    });

    const allSpent = months.map((m) => m.totalSpent).filter((s) => s > 0);
    const avgMonthlySpend =
      allSpent.length > 0
        ? Math.round(
            (allSpent.reduce((a, b) => a + b, 0) / allSpent.length) * 100
          ) / 100
        : 0;
    const totalYearToDate = months
      .filter((m) => m.year === currentYear)
      .reduce((sum, m) => sum + m.totalSpent, 0);

    return NextResponse.json({
      months,
      summary: {
        avgMonthlySpend,
        totalYearToDate: Math.round(totalYearToDate * 100) / 100,
        highestMonth: months.reduce(
          (max, m) => (m.totalSpent > max.totalSpent ? m : max),
          months[0]
        )?.label,
        lowestMonth: months
          .filter((m) => m.totalSpent > 0)
          .reduce(
            (min, m) => (m.totalSpent < min.totalSpent ? m : min),
            months[0]
          )?.label,
      },
    });
  } catch (err) {
    console.error("Failed to fetch monthly data:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
