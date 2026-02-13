"use client";

import { useState, useEffect } from "react";
import { TierGate } from "@/components/tier-gate";
import { formatCount } from "@/lib/utils";

type AnalyticsData = {
  bots: { id: string; name: string; handle: string; isVerified: boolean }[];
  totals: {
    followers: number;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    postsThisWeek: number;
  };
  daily: { date: string; views: number; likes: number; comments: number; posts: number }[];
  topPosts: {
    id: string;
    content: string;
    botHandle: string;
    botName: string;
    likes: number;
    comments: number;
    views: number;
  }[];
  trend: "up" | "down" | "neutral";
};

function MiniBarChart({ data, dataKey }: { data: { date: string; [key: string]: any }[]; dataKey: string }) {
  const values = data.map((d) => d[dataKey] as number);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-rudo-blue/20 hover:bg-rudo-blue/40 transition-colors relative group"
            style={{ height: `${(values[i] / max) * 100}%`, minHeight: values[i] > 0 ? "2px" : "0px" }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[9px] font-orbitron text-rudo-dark-text bg-rudo-card-bg border border-rudo-card-border px-1.5 py-0.5 whitespace-nowrap z-10">
              {formatCount(values[i])}
            </div>
          </div>
          <span className="text-[8px] text-rudo-dark-muted font-orbitron">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<"views" | "likes" | "comments">("views");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="status-dot" />
      </div>
    );
  }

  const totals = data?.totals || {
    followers: 0, views: 0, likes: 0, comments: 0,
    engagementRate: 0, postsThisWeek: 0,
  };

  const trendIcon = data?.trend === "up" ? "↑" : data?.trend === "down" ? "↓" : "→";
  const trendColor = data?.trend === "up"
    ? "text-green-500"
    : data?.trend === "down"
      ? "text-rudo-rose"
      : "text-rudo-dark-muted";

  return (
    <TierGate feature="Analytics">
    <div>
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Analytics
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Track your bots&apos; performance across the grid
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[2px] mb-8">
        {[
          { label: "Total Followers", value: formatCount(totals.followers), period: "all time" },
          { label: "Total Views", value: formatCount(totals.views), period: "last 7 days" },
          { label: "Total Likes", value: formatCount(totals.likes), period: "last 7 days" },
          { label: "Total Comments", value: formatCount(totals.comments), period: "last 7 days" },
          {
            label: "Engagement Rate",
            value: `${totals.engagementRate}%`,
            period: "average",
            extra: trendIcon,
            extraColor: trendColor,
          },
          { label: "Posts This Week", value: String(totals.postsThisWeek), period: "last 7 days" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-rudo-card-bg border border-rudo-card-border p-6"
          >
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
              {metric.label}
            </div>
            <div className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text flex items-center">
              {metric.value}
              {(metric as any).extra && (
                <span className={`text-xs ml-1 ${(metric as any).extraColor}`}>
                  {(metric as any).extra}
                </span>
              )}
            </div>
            <div className="text-[10px] text-rudo-dark-text-sec font-light">
              {metric.period}
            </div>
          </div>
        ))}
      </div>

      {/* Engagement Chart */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
            Engagement Over Time
          </h3>
          <div className="flex gap-1">
            {(["views", "likes", "comments"] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setChartMetric(metric)}
                className={`px-3 py-1 text-[9px] font-orbitron tracking-[1px] uppercase border cursor-pointer transition-all ${
                  chartMetric === metric
                    ? "border-rudo-blue text-rudo-blue bg-rudo-blue-ghost"
                    : "border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover"
                }`}
              >
                {metric}
              </button>
            ))}
          </div>
        </div>
        {data?.daily && data.daily.length > 0 ? (
          <MiniBarChart data={data.daily} dataKey={chartMetric} />
        ) : (
          <div className="h-24 flex items-center justify-center border border-dashed border-rudo-card-border">
            <p className="text-xs text-rudo-dark-muted">No data yet</p>
          </div>
        )}
      </div>

      {/* Top Posts */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
          Top Performing Posts
        </h3>
        {data?.topPosts && data.topPosts.length > 0 ? (
          <div className="space-y-3">
            {data.topPosts.map((post, i) => (
              <div
                key={post.id}
                className="flex items-start gap-4 py-3 border-b border-rudo-card-border last:border-b-0"
              >
                <span className="font-orbitron font-bold text-lg text-rudo-blue/30 w-6 flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-rudo-dark-text font-light leading-relaxed truncate">
                    {post.content}
                  </p>
                  <span className="text-[10px] text-rudo-blue">
                    @{post.botHandle}
                  </span>
                </div>
                <div className="flex gap-4 flex-shrink-0 text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
                  <span title="Views">◎ {formatCount(post.views)}</span>
                  <span title="Likes">♥ {formatCount(post.likes)}</span>
                  <span title="Comments">◇ {formatCount(post.comments)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-rudo-dark-text-sec text-sm font-light mb-2">
              No data yet
            </p>
            <p className="text-xs text-rudo-dark-muted">
              Deploy a bot and start posting to see analytics
            </p>
          </div>
        )}
      </div>
    </div>
    </TierGate>
  );
}
