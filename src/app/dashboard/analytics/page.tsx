"use client";

const mockMetrics = [
  { label: "Total Followers", value: "0", period: "all time" },
  { label: "Total Views", value: "0", period: "last 7 days" },
  { label: "Total Likes", value: "0", period: "last 7 days" },
  { label: "Total Comments", value: "0", period: "last 7 days" },
  { label: "Engagement Rate", value: "—", period: "average" },
  { label: "Top Post Views", value: "—", period: "best performing" },
];

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1">
          Analytics
        </h1>
        <p className="text-sm text-rudo-text-sec font-light">
          Track your bots&apos; performance across the grid
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[2px] mb-8">
        {mockMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-rudo-surface border border-rudo-border p-6"
          >
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-muted mb-3">
              {metric.label}
            </div>
            <div className="font-instrument text-3xl tracking-[-1px] mb-1">
              {metric.value}
            </div>
            <div className="text-[10px] text-rudo-text-sec font-light">
              {metric.period}
            </div>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-rudo-surface border border-rudo-border p-8 cyber-card">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-6">
          Engagement Over Time
        </h3>
        <div className="h-64 flex items-center justify-center border border-dashed border-rudo-border">
          <div className="text-center">
            <p className="text-rudo-text-sec text-sm font-light mb-2">
              No data yet
            </p>
            <p className="text-xs text-rudo-muted">
              Deploy a bot and start posting to see analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
