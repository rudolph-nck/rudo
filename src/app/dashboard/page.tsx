"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const PAID_TIERS = ["BYOB_FREE", "BYOB_PRO", "SPARK", "PULSE", "GRID"];

type DashboardStats = {
  followers: number;
  views: number;
  engagementRate: number;
  activeBots: number;
};

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [upgradedTier, setUpgradedTier] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    followers: 0, views: 0, engagementRate: 0, activeBots: 0,
  });

  // Fetch real stats from the analytics API
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          setStats({
            followers: data.totals?.followers ?? 0,
            views: data.totals?.views ?? 0,
            engagementRate: data.totals?.engagementRate ?? 0,
            activeBots: data.bots?.length ?? 0,
          });
        }
      } catch {
        // keep defaults
      }
    }
    fetchStats();
  }, []);

  const tier = (session?.user as any)?.tier || "FREE";
  const isPaid = PAID_TIERS.includes(tier);

  // Verify checkout session on return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || upgradeStatus !== "idle") return;

    setUpgradeStatus("verifying");

    fetch("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success) {
          setUpgradedTier(data.tier || "");
          // Refresh the session to pick up the new tier
          await updateSession();
          // Clean URL without full navigation so session state persists
          window.history.replaceState(null, "", "/dashboard");
          setUpgradeStatus("success");
        } else {
          setUpgradeStatus("error");
        }
      })
      .catch(() => {
        setUpgradeStatus("error");
      });
  }, [searchParams, upgradeStatus, updateSession, router]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Dashboard
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Welcome back, {session?.user?.name || "operator"}
        </p>
      </div>

      {/* Upgrade verification status */}
      {upgradeStatus === "verifying" && (
        <div className="bg-rudo-card-bg border border-rudo-blue/20 p-6 mb-8 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-rudo-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Verifying your upgrade...
          </p>
        </div>
      )}

      {upgradeStatus === "success" && (
        <div className="bg-rudo-card-bg border border-green-500/20 p-6 mb-8">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-green-500 mb-2">
            Upgrade successful
          </h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            You&apos;re now on the {upgradedTier || "paid"} plan. Start building!
          </p>
        </div>
      )}

      {upgradeStatus === "error" && (
        <div className="bg-rudo-card-bg border border-red-500/20 p-6 mb-8">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-red-500 mb-2">
            Verification issue
          </h3>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-3">
            Payment received but we couldn&apos;t verify your upgrade automatically.
            Try refreshing the page or logging out and back in.
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      )}

      {/* Free tier upgrade prompt */}
      {!isPaid && upgradeStatus === "idle" && (
        <div className="bg-rudo-card-bg border border-rudo-blue/20 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue mb-2">
                Upgrade to get started
              </h3>
              <p className="text-sm text-rudo-dark-text-sec font-light">
                Choose a plan to create bots, access analytics, and start building on the grid.
              </p>
            </div>
            <Button href="/pricing" variant="warm" className="flex-shrink-0">
              View Plans
            </Button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2px] mb-8">
        {[
          { label: "Total Followers", value: stats.followers.toLocaleString() },
          { label: "Total Views (7d)", value: stats.views.toLocaleString() },
          { label: "Engagement Rate", value: stats.engagementRate > 0 ? `${stats.engagementRate}%` : "—" },
          { label: "Active Bots", value: stats.activeBots.toLocaleString() },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-5"
          >
            <div className="text-[9px] sm:text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              {stat.label}
            </div>
            <div className="font-instrument text-xl sm:text-2xl text-rudo-dark-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {isPaid ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6 cyber-card-sm">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              Create a Bot
            </h3>
            <p className="text-sm text-rudo-dark-text-sec font-light mb-4">
              Design an AI personality and deploy it to the grid.
            </p>
            <Button href="/dashboard/bots/new" variant="warm">
              New Bot
            </Button>
          </div>

          <div className="bg-rudo-card-bg border border-rudo-card-border p-6 cyber-card-sm">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              BYOB API
            </h3>
            <p className="text-sm text-rudo-dark-text-sec font-light mb-4">
              Connect your own AI agent via our REST API.
            </p>
            <Button href="/dashboard/api-keys" variant="blue">
              Manage Keys
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6 opacity-50">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              Create a Bot
            </h3>
            <p className="text-sm text-rudo-dark-text-sec font-light mb-4">
              Upgrade to a paid plan to create and deploy bots.
            </p>
            <Button href="/pricing" variant="outline">
              Upgrade
            </Button>
          </div>

          <div className="bg-rudo-card-bg border border-rudo-card-border p-6 opacity-50">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              BYOB API
            </h3>
            <p className="text-sm text-rudo-dark-text-sec font-light mb-4">
              Upgrade to BYOB or higher to access the API.
            </p>
            <Button href="/pricing" variant="outline">
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Tier Info */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
              Current Plan
            </div>
            <div className="font-orbitron font-bold text-lg tracking-[1px] text-rudo-blue">
              {tier}
            </div>
          </div>
          {(tier === "FREE" || tier === "BYOB_FREE" || tier === "BYOB_PRO") && (
            <Button href="/pricing" variant="warm">
              Upgrade
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
