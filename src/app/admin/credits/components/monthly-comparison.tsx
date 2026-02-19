"use client";

type MonthData = {
  year: number;
  month: number;
  label: string;
  totalSpent: number;
  totalCalls: number;
  avgCostPerCall: number;
  changeFromPrevious: number | null;
  changePercent: number | null;
};

type Summary = {
  avgMonthlySpend: number;
  totalYearToDate: number;
  highestMonth: string | null;
  lowestMonth: string | null;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function MonthlyComparison({
  months,
  summary,
}: {
  months: MonthData[];
  summary: Summary;
}) {
  if (!months.length) {
    return (
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Month Over Month
        </div>
        <div className="py-8 text-center text-sm text-rudo-dark-text-sec">
          No monthly data yet
        </div>
      </div>
    );
  }

  const maxSpent = Math.max(...months.map((m) => m.totalSpent), 1);

  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6">
      <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
        Month Over Month
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {months.map((m) => (
          <div key={`${m.year}-${m.month}`} className="text-center">
            <div className="text-[8px] sm:text-[9px] font-orbitron tracking-wider uppercase text-rudo-dark-muted mb-2">
              {m.label.split(" ")[0].slice(0, 3)}
            </div>
            <div className="flex justify-center mb-2">
              <div className="w-8 sm:w-10 bg-rudo-content-bg border border-rudo-card-border/50 overflow-hidden relative" style={{ height: 60 }}>
                <div
                  className="absolute bottom-0 w-full bg-rudo-blue/50 transition-all"
                  style={{
                    height: `${(m.totalSpent / maxSpent) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="font-instrument text-xs sm:text-sm text-rudo-dark-text">
              {fmt(m.totalSpent)}
            </div>
            {m.changePercent !== null && (
              <div
                className={`text-[10px] mt-0.5 ${
                  m.changePercent > 0
                    ? "text-rudo-rose"
                    : m.changePercent < 0
                    ? "text-green-500"
                    : "text-rudo-dark-muted"
                }`}
              >
                {m.changePercent > 0 ? "+" : ""}
                {m.changePercent}%
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-rudo-card-border pt-4 flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-rudo-dark-text-sec">
        <span>
          Avg:{" "}
          <strong className="text-rudo-dark-text font-instrument">
            {fmt(summary.avgMonthlySpend)}/mo
          </strong>
        </span>
        <span className="text-rudo-dark-muted/30">|</span>
        <span>
          YTD:{" "}
          <strong className="text-rudo-dark-text font-instrument">
            {fmt(summary.totalYearToDate)}
          </strong>
        </span>
        {summary.highestMonth && (
          <>
            <span className="text-rudo-dark-muted/30">|</span>
            <span>
              Highest:{" "}
              <strong className="text-rudo-dark-text font-instrument">
                {summary.highestMonth}
              </strong>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
