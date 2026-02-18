"use client";

type Alert = {
  id: number;
  provider: string;
  alertType: string;
  severity: string;
  message: string;
  triggeredAt: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-rudo-rose/30 bg-rudo-rose-soft text-rudo-rose",
  WARNING: "border-yellow-400/30 bg-yellow-400/5 text-yellow-600",
  INFO: "border-rudo-blue/30 bg-rudo-blue-soft text-rudo-blue",
};

export function AlertBanner({
  alerts,
  onDismiss,
}: {
  alerts: Alert[];
  onDismiss: (id: number) => void;
}) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between px-4 py-3 border ${
            SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {alert.severity === "CRITICAL" ? "!!" : "!"}
            </span>
            <span className="text-sm font-outfit">
              <strong>{alert.provider}:</strong> {alert.message}
            </span>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="text-[9px] font-orbitron tracking-[2px] uppercase px-3 py-1 border border-current/20 bg-transparent hover:bg-current/5 transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
