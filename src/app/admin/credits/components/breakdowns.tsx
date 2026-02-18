"use client";

import { timeAgo } from "@/lib/utils";

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

type EffectData = {
  effectId: string;
  totalCost: number;
  totalCalls: number;
  avgCostPerCall: number;
};

type BotData = {
  botId: string;
  botName: string;
  totalCost: number;
  totalCalls: number;
};

type RecentCall = {
  id: number;
  provider: string;
  providerName: string;
  costUsd: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export function BreakdownByProvider({
  providers,
}: {
  providers: { providerName: string; displayName: string; spentThisMonth: number }[];
}) {
  const total = providers.reduce((s, p) => s + p.spentThisMonth, 0);
  const sorted = [...providers].sort((a, b) => b.spentThisMonth - a.spentThisMonth);

  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        By Provider
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-rudo-dark-text-sec">No spending data</p>
      ) : (
        <div className="space-y-3">
          {sorted.slice(0, 5).map((p) => {
            const pct = total > 0 ? Math.round((p.spentThisMonth / total) * 100) : 0;
            return (
              <div key={p.providerName} className="flex items-center justify-between">
                <span className="text-sm text-rudo-dark-text font-outfit">
                  {p.displayName}
                </span>
                <span className="text-sm text-rudo-dark-text-sec font-outfit tabular-nums">
                  {fmt(p.spentThisMonth)}{" "}
                  <span className="text-rudo-dark-muted text-xs">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BreakdownByEffect({ data }: { data: EffectData[] }) {
  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        By Effect
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-rudo-dark-text-sec">No effect data</p>
      ) : (
        <div className="space-y-3">
          {data.slice(0, 5).map((e) => (
            <div key={e.effectId} className="flex items-center justify-between">
              <span className="text-sm text-rudo-dark-text font-outfit">
                {e.effectId?.replace(/_/g, " ") || "Unknown"}
              </span>
              <span className="text-sm text-rudo-dark-text-sec font-outfit tabular-nums">
                {fmt(e.totalCost)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BreakdownByBot({ data }: { data: BotData[] }) {
  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        By Bot
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-rudo-dark-text-sec">No bot data</p>
      ) : (
        <div className="space-y-3">
          {data.slice(0, 5).map((b) => (
            <div key={b.botId} className="flex items-center justify-between">
              <span className="text-sm text-rudo-dark-text font-outfit">
                {b.botName}
              </span>
              <span className="text-sm text-rudo-dark-text-sec font-outfit tabular-nums">
                {fmt(b.totalCost)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentCallsLog({ data }: { data: RecentCall[] }) {
  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        Recent API Calls
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-rudo-dark-text-sec">No API calls logged</p>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 10).map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted w-14">
                  {timeAgo(new Date(call.createdAt))}
                </span>
                <span className="text-rudo-dark-text font-outfit">
                  {call.provider}
                </span>
                <span
                  className={
                    call.status === "SUCCESS"
                      ? "text-green-500"
                      : "text-rudo-rose"
                  }
                >
                  {call.status === "SUCCESS" ? "+" : "x"}
                </span>
              </div>
              <span className="font-outfit tabular-nums text-rudo-dark-text-sec">
                {call.status === "SUCCESS"
                  ? fmt(call.costUsd)
                  : call.errorMessage?.slice(0, 20) || "Error"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
