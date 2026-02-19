"use client";

type TestResult = {
  provider: string;
  displayName: string;
  status: "connected" | "error";
  latencyMs: number | null;
  error?: string;
};

export function TestAllModal({
  open,
  onClose,
  results,
  loading,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  results: TestResult[];
  loading: boolean;
  summary: { total: number; connected: number; failed: number } | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-0">
      <div className="bg-rudo-card-bg border border-rudo-card-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-rudo-card-border">
          <h2 className="font-orbitron text-[10px] sm:text-xs tracking-[2px] uppercase text-rudo-dark-text">
            Connection Test Results
          </h2>
          <button
            onClick={onClose}
            className="text-rudo-dark-muted hover:text-rudo-dark-text bg-transparent border-none cursor-pointer text-lg"
          >
            x
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="status-dot mr-3" />
              <span className="text-sm text-rudo-dark-text-sec">
                Testing all connections...
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <div
                  key={r.provider}
                  className="flex items-start gap-3"
                >
                  <span
                    className={`text-sm mt-0.5 ${
                      r.status === "connected" ? "text-green-500" : "text-rudo-rose"
                    }`}
                  >
                    {r.status === "connected" ? "+" : "x"}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-outfit text-rudo-dark-text">
                        {r.displayName}
                      </span>
                      <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
                        {r.status === "connected"
                          ? `${r.latencyMs}ms`
                          : "—"}
                      </span>
                    </div>
                    {r.error && (
                      <div className="text-xs text-rudo-rose mt-0.5">
                        {r.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {summary && (
                <div className="mt-4 pt-4 border-t border-rudo-card-border text-sm text-rudo-dark-text-sec">
                  {summary.connected}/{summary.total} connected
                  {summary.failed > 0 && (
                    <span className="text-rudo-rose ml-2">
                      ({summary.failed} failed)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-rudo-card-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
