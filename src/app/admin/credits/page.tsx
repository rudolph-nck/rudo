"use client";

import { useState, useEffect, useCallback } from "react";
import { ProviderCards } from "./components/provider-cards";
import { SpendingSummary } from "./components/spending-summary";
import { SpendingChart } from "./components/spending-chart";
import { MonthlyComparison } from "./components/monthly-comparison";
import { AlertBanner } from "./components/alert-banner";
import { AddProviderModal } from "./components/add-provider-modal";
import { TestAllModal } from "./components/test-all-modal";
import {
  BreakdownByProvider,
  BreakdownByEffect,
  BreakdownByBot,
  RecentCallsLog,
} from "./components/breakdowns";

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
  capabilities?: any;
  baseUrl?: string;
  priorityOrder?: number;
};

type Totals = {
  spentToday: number;
  spentThisWeek: number;
  spentThisMonth: number;
  totalMonthlyBudget: number;
  percentTotalBudgetUsed: number;
};

export default function CreditsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [totals, setTotals] = useState<Totals>({
    spentToday: 0,
    spentThisWeek: 0,
    spentThisMonth: 0,
    totalMonthlyBudget: 0,
    percentTotalBudgetUsed: 0,
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any>({ months: [], summary: {} });
  const [effectData, setEffectData] = useState<any[]>([]);
  const [botData, setBotData] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [chartTab, setChartTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showTestAll, setShowTestAll] = useState(false);
  const [testAllResults, setTestAllResults] = useState<any[]>([]);
  const [testAllSummary, setTestAllSummary] = useState<any>(null);
  const [testAllLoading, setTestAllLoading] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/credits/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
        setTotals(data.totals);
      }
    } catch {
      // silent
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/credits/alerts?unacknowledged=true");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
      }
    } catch {
      // silent
    }
  }, []);

  const loadChartData = useCallback(
    async (groupBy: string) => {
      try {
        const res = await fetch(
          `/api/admin/credits/usage?groupBy=${groupBy}`
        );
        if (res.ok) {
          const data = await res.json();
          setChartData(data.data);
        }
      } catch {
        // silent
      }
    },
    []
  );

  const loadMonthly = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/credits/monthly?months=6");
      if (res.ok) {
        const data = await res.json();
        setMonthlyData(data);
      }
    } catch {
      // silent
    }
  }, []);

  const loadBreakdowns = useCallback(async () => {
    try {
      const [effectRes, botRes, recentRes] = await Promise.all([
        fetch("/api/admin/credits/usage?view=by-effect"),
        fetch("/api/admin/credits/usage?view=by-bot"),
        fetch("/api/admin/credits/usage?view=recent"),
      ]);

      if (effectRes.ok) {
        const data = await effectRes.json();
        setEffectData(data.data);
      }
      if (botRes.ok) {
        const data = await botRes.json();
        setBotData(data.data);
      }
      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentCalls(data.data);
      }
    } catch {
      // silent
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        loadProviders(),
        loadAlerts(),
        loadChartData("daily"),
        loadMonthly(),
        loadBreakdowns(),
      ]);
      setLoading(false);
    }
    init();
  }, [loadProviders, loadAlerts, loadChartData, loadMonthly, loadBreakdowns]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadProviders();
      loadAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadProviders, loadAlerts]);

  // Reload chart when tab changes
  useEffect(() => {
    loadChartData(chartTab);
  }, [chartTab, loadChartData]);

  async function handleSeedProviders() {
    try {
      const res = await fetch("/api/admin/credits/seed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const parts: string[] = [];
        if (data.imported.length) parts.push(`Imported: ${data.imported.join(", ")}`);
        if (data.skipped.length) parts.push(`Already existed: ${data.skipped.join(", ")}`);
        if (data.missing.length) parts.push(`Missing env vars: ${data.missing.join(", ")}`);
        alert(parts.join("\n\n") || "No providers to import");
        await loadProviders();
      }
    } catch {
      alert("Seed failed");
    }
  }

  async function handleTestOne(providerId: number) {
    setTestingId(providerId);
    try {
      await fetch("/api/admin/credits/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      await loadProviders();
    } catch {
      // silent
    } finally {
      setTestingId(null);
    }
  }

  async function handleTestAll() {
    setShowTestAll(true);
    setTestAllLoading(true);
    setTestAllResults([]);
    setTestAllSummary(null);
    try {
      const res = await fetch("/api/admin/credits/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestAllResults(data.results);
        setTestAllSummary(data.summary);
      }
      await loadProviders();
    } catch {
      // silent
    } finally {
      setTestAllLoading(false);
    }
  }

  async function handleDismissAlert(alertId: number) {
    try {
      await fetch(`/api/admin/credits/alerts/${alertId}/acknowledge`, {
        method: "POST",
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // silent
    }
  }

  function handleRefreshAll() {
    loadProviders();
    loadAlerts();
    loadChartData(chartTab);
    loadMonthly();
    loadBreakdowns();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="status-dot mx-auto mb-4" />
        <p className="text-rudo-dark-text-sec text-sm ml-3">Loading credit dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            API Credit Dashboard
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Monitor and manage external API connections
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {providers.length === 0 && (
            <button
              onClick={handleSeedProviders}
              className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-yellow-400/20 text-yellow-500 bg-transparent hover:bg-yellow-400/5 transition-all cursor-pointer"
            >
              Import from Env
            </button>
          )}
          <button
            onClick={handleTestAll}
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer"
          >
            Test All
          </button>
          <button
            onClick={() => {
              setEditingProvider(null);
              setShowAddModal(true);
            }}
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-green-400/20 text-green-400 bg-transparent hover:bg-green-400/5 transition-all cursor-pointer"
          >
            + Add API
          </button>
          <button
            onClick={handleRefreshAll}
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

      {/* Provider Cards */}
      <div className="mb-6">
        <ProviderCards
          providers={providers}
          onTest={handleTestOne}
          onEdit={(p) => {
            setEditingProvider(p);
            setShowAddModal(true);
          }}
          testingId={testingId}
        />
      </div>

      {/* Spending Summary */}
      <div className="mb-6">
        <SpendingSummary totals={totals} />
      </div>

      {/* Chart Tabs + Chart */}
      <div className="mb-6">
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {(["daily", "weekly", "monthly"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setChartTab(tab)}
              className={`px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border transition-all cursor-pointer flex-shrink-0 ${
                chartTab === tab
                  ? "border-rudo-blue/30 text-rudo-blue bg-rudo-blue-soft"
                  : "border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <SpendingChart data={chartData} tab={chartTab} />
      </div>

      {/* Monthly Comparison */}
      <div className="mb-6">
        <MonthlyComparison
          months={monthlyData.months}
          summary={monthlyData.summary}
        />
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 sm:mb-6">
        <BreakdownByProvider providers={providers} />
        <BreakdownByEffect data={effectData} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BreakdownByBot data={botData} />
        <RecentCallsLog data={recentCalls} />
      </div>

      {/* Modals */}
      <AddProviderModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingProvider(null);
        }}
        onSaved={() => {
          loadProviders();
          setShowAddModal(false);
          setEditingProvider(null);
        }}
        editingProvider={editingProvider}
      />

      <TestAllModal
        open={showTestAll}
        onClose={() => setShowTestAll(false)}
        results={testAllResults}
        loading={testAllLoading}
        summary={testAllSummary}
      />
    </div>
  );
}
