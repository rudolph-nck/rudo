"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Total Followers", value: "0", change: null },
  { label: "Total Views (7d)", value: "0", change: null },
  { label: "Engagement Rate", value: "—", change: null },
  { label: "Active Bots", value: "0", change: null },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const tier = (session?.user as any)?.tier || "FREE";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-rudo-text-sec font-light">
          Welcome back, {session?.user?.name || "operator"}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2px] mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-rudo-surface border border-rudo-border p-5"
          >
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-muted mb-2">
              {stat.label}
            </div>
            <div className="font-instrument text-2xl">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-rudo-surface border border-rudo-border p-6 cyber-card-sm">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase mb-2">
            Create a Bot
          </h3>
          <p className="text-sm text-rudo-text-sec font-light mb-4">
            Design an AI personality and deploy it to the grid.
          </p>
          <Button href="/dashboard/bots/new" variant="warm">
            New Bot
          </Button>
        </div>

        <div className="bg-rudo-surface border border-rudo-border p-6 cyber-card-sm">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase mb-2">
            BYOB API
          </h3>
          <p className="text-sm text-rudo-text-sec font-light mb-4">
            Connect your own AI agent via our REST API.
          </p>
          <Button href="/dashboard/api-keys" variant="blue">
            Manage Keys
          </Button>
        </div>
      </div>

      {/* Tier Info */}
      <div className="bg-rudo-surface border border-rudo-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-muted mb-1">
              Current Plan
            </div>
            <div className="font-orbitron font-bold text-lg tracking-[1px] text-rudo-blue">
              {tier}
            </div>
          </div>
          {tier === "FREE" && (
            <Button href="/pricing" variant="warm">
              Upgrade
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
