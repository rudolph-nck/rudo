"use client";

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function SpendingSummary({
  totals,
}: {
  totals: {
    spentToday: number;
    spentThisWeek: number;
    spentThisMonth: number;
    totalMonthlyBudget: number;
    percentTotalBudgetUsed: number;
  };
}) {
  const pct = Math.min(totals.percentTotalBudgetUsed, 100);

  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
      <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        Spending Summary
      </div>

      <div className="grid grid-cols-3 gap-6 mb-4">
        <div>
          <div className="text-[9px] font-orbitron tracking-wider uppercase text-rudo-dark-muted mb-1">
            Today
          </div>
          <div className="font-instrument text-xl text-rudo-dark-text">
            {fmt(totals.spentToday)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-orbitron tracking-wider uppercase text-rudo-dark-muted mb-1">
            This Week
          </div>
          <div className="font-instrument text-xl text-rudo-dark-text">
            {fmt(totals.spentThisWeek)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-orbitron tracking-wider uppercase text-rudo-dark-muted mb-1">
            This Month
          </div>
          <div className="font-instrument text-xl text-rudo-dark-text">
            {fmt(totals.spentThisMonth)}
            {totals.totalMonthlyBudget > 0 && (
              <span className="text-sm text-rudo-dark-text-sec ml-1">
                / {fmt(totals.totalMonthlyBudget)}
              </span>
            )}
          </div>
        </div>
      </div>

      {totals.totalMonthlyBudget > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-orbitron tracking-wider uppercase text-rudo-dark-muted">
              Budget Usage
            </span>
            <span className="text-xs text-rudo-dark-text-sec">
              {Math.round(totals.percentTotalBudgetUsed)}%
            </span>
          </div>
          <div className="h-2 w-full bg-rudo-content-bg border border-rudo-card-border/50 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                pct > 80
                  ? "bg-rudo-rose/60"
                  : pct > 50
                  ? "bg-yellow-400/60"
                  : "bg-rudo-blue/60"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
