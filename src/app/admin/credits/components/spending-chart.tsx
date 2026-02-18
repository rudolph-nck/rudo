"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type DailyData = {
  date: string;
  totalCost: number;
  totalCalls: number;
  successRate: number;
  breakdown: { provider: string; cost: number; calls: number }[];
};

const PROVIDER_COLORS: Record<string, string> = {
  minimax: "#38bdf8",
  hailua: "#a78bfa",
  kling: "#34d399",
  runway: "#fb923c",
  runwayml: "#fb923c",
  elevenlabs: "#f472b6",
  fal: "#facc15",
  "fal.ai": "#facc15",
  openai: "#10b981",
};

function getColor(provider: string) {
  return PROVIDER_COLORS[provider.toLowerCase()] || "#94a3b8";
}

export function SpendingChart({
  data,
  tab,
}: {
  data: DailyData[];
  tab: string;
}) {
  if (!data.length) {
    return (
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Spending Over Time
        </div>
        <div className="h-[300px] flex items-center justify-center text-sm text-rudo-dark-text-sec">
          No usage data yet
        </div>
      </div>
    );
  }

  // Collect all unique providers across all data points
  const allProviders = new Set<string>();
  for (const d of data) {
    for (const b of d.breakdown) {
      allProviders.add(b.provider);
    }
  }

  // Reshape data for stacked bar chart
  const chartData = data.map((d) => {
    const row: any = { date: d.date, total: d.totalCost };
    for (const prov of allProviders) {
      const match = d.breakdown.find((b) => b.provider === prov);
      row[prov] = match ? match.cost : 0;
    }
    return row;
  });

  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        {tab === "daily"
          ? "Daily Spending"
          : tab === "weekly"
          ? "Weekly Spending"
          : "Monthly Spending"}
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => {
                if (v.length === 7) return v; // monthly
                const parts = v.split("-");
                return `${parts[1]}/${parts[2]}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value: any) =>
                `$${Number(value || 0).toFixed(2)}`
              }
              labelStyle={{ fontFamily: "Orbitron", fontSize: 10 }}
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "Outfit" }}
            />
            {Array.from(allProviders).map((prov) => (
              <Bar
                key={prov}
                dataKey={prov}
                stackId="spending"
                fill={getColor(prov)}
                name={prov}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
