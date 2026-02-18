"use client";

type Provider = {
  id: number;
  providerName: string;
  displayName: string;
  purpose: string;
  currentBalance: number;
  currency: string;
  monthlyBudget: number;
  spentThisMonth: number;
  percentBudgetUsed: number;
  alertThreshold: number;
  connectionStatus: string;
  isActive: boolean;
  lastSuccessfulCall: string | null;
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  CONNECTED: { label: "Online", color: "text-green-500" },
  DISCONNECTED: { label: "Offline", color: "text-rudo-dark-muted" },
  ERROR: { label: "Error", color: "text-rudo-rose" },
  LOW_BALANCE: { label: "Low Balance", color: "text-yellow-500" },
  PENDING_TEST: { label: "Untested", color: "text-rudo-dark-muted" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function ProviderCards({
  providers,
  onTest,
  onEdit,
  testingId,
}: {
  providers: Provider[];
  onTest: (id: number) => void;
  onEdit: (provider: Provider) => void;
  testingId: number | null;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {providers.map((p) => {
        const status = STATUS_STYLES[p.connectionStatus] || STATUS_STYLES.PENDING_TEST;
        const isLow = p.currentBalance > 0 && p.currentBalance < p.alertThreshold;
        const budgetPct = Math.min(p.percentBudgetUsed, 100);

        return (
          <div
            key={p.id}
            className="min-w-[200px] bg-rudo-card-bg border border-rudo-card-border p-4 flex-shrink-0 cursor-pointer hover:border-rudo-card-border-hover transition-all"
            onClick={() => onEdit(p)}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted truncate">
                {p.displayName}
              </span>
              <span className={`text-[9px] font-orbitron tracking-wider ${status.color}`}>
                {status.label}
              </span>
            </div>

            <div className={`font-instrument text-xl mb-1 ${isLow ? "text-yellow-500" : "text-rudo-dark-text"}`}>
              {fmt(p.currentBalance)}
              {isLow && <span className="text-yellow-500 ml-1 text-sm">!</span>}
            </div>

            {p.monthlyBudget > 0 && (
              <>
                <div className="text-[10px] text-rudo-dark-text-sec mb-1">
                  {Math.round(p.percentBudgetUsed)}% of {fmt(p.monthlyBudget)} budget
                </div>
                <div className="h-1.5 w-full bg-rudo-content-bg border border-rudo-card-border/50 overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all ${
                      budgetPct > 80 ? "bg-rudo-rose/60" : budgetPct > 50 ? "bg-yellow-400/60" : "bg-rudo-blue/60"
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onTest(p.id);
              }}
              disabled={testingId === p.id}
              className="w-full mt-1 px-3 py-1.5 text-[9px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer disabled:opacity-40"
            >
              {testingId === p.id ? "Testing..." : "Test"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
