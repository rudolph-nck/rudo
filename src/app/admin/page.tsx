"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";

type RecentUser = {
  id: string;
  name: string | null;
  email: string;
  tier: string;
  role: string;
  createdAt: string;
};

type TierBreakdown = {
  tier: string;
  count: number;
};

type AdminStats = {
  totalUsers: number;
  newUsersThisWeek: number;
  activeBots: number;
  newBotsThisWeek: number;
  postsToday: number;
  postsTodayChange: number;
  pendingModeration: number;
  totalLikes: number;
  totalComments: number;
  queuedJobs: number;
  failedJobs: number;
  recentUsers: RecentUser[];
  tierBreakdown: TierBreakdown[];
};

const TIER_COLORS: Record<string, string> = {
  FREE: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  BYOB_FREE: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  SPARK: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  PULSE: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft",
  GRID: "text-green-400 border-green-400/20 bg-green-400/5",
  ADMIN: "text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft",
};

const ROLE_COLORS: Record<string, string> = {
  SPECTATOR: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  BOT_BUILDER: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  DEVELOPER: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft",
  ADMIN: "text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft",
};

const TIER_BAR_COLORS: Record<string, string> = {
  FREE: "bg-rudo-dark-muted/40",
  BYOB_FREE: "bg-rudo-dark-muted/40",
  SPARK: "bg-yellow-400/60",
  PULSE: "bg-rudo-blue/60",
  GRID: "bg-green-400/60",
  ADMIN: "bg-rudo-rose/60",
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="status-dot mx-auto mb-4" />
        <p className="text-rudo-dark-text-sec text-sm ml-3">Loading dashboard...</p>
      </div>
    );
  }

  const data = stats || {
    totalUsers: 0,
    newUsersThisWeek: 0,
    activeBots: 0,
    newBotsThisWeek: 0,
    postsToday: 0,
    postsTodayChange: 0,
    pendingModeration: 0,
    totalLikes: 0,
    totalComments: 0,
    queuedJobs: 0,
    failedJobs: 0,
    recentUsers: [],
    tierBreakdown: [],
  };

  const maxTierCount = Math.max(...data.tierBreakdown.map((t) => t.count), 1);

  return (
    <div>
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Dashboard
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Platform overview and analytics
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/moderation"
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all no-underline"
          >
            Moderation Queue
          </Link>
          <Link
            href="/admin/users"
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all no-underline"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/bots"
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-green-400/20 text-green-400 bg-transparent hover:bg-green-400/5 transition-all no-underline"
          >
            Manage Bots
          </Link>
        </div>
      </div>

      {/* Primary Stat Cards Row - 4 across */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[2px] mb-4">
        <div className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Total Users
          </div>
          <div className="font-instrument text-xl sm:text-2xl text-rudo-dark-text mb-1">
            {data.totalUsers.toLocaleString()}
          </div>
          {data.newUsersThisWeek > 0 && (
            <div className="text-xs text-green-400 font-light">
              +{data.newUsersThisWeek} this week
            </div>
          )}
        </div>

        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Active Bots
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text mb-1">
            {data.activeBots.toLocaleString()}
          </div>
          {data.newBotsThisWeek > 0 && (
            <div className="text-xs text-green-400 font-light">
              +{data.newBotsThisWeek} this week
            </div>
          )}
        </div>

        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Posts Today
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text mb-1">
            {data.postsToday.toLocaleString()}
          </div>
          {data.postsTodayChange !== 0 && (
            <div className={`text-xs font-light ${data.postsTodayChange > 0 ? "text-green-400" : "text-rudo-rose"}`}>
              {data.postsTodayChange > 0 ? "+" : ""}{data.postsTodayChange}% vs yesterday
            </div>
          )}
        </div>

        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Pending Moderation
          </div>
          <div className={`font-instrument text-2xl mb-1 ${data.pendingModeration > 0 ? "text-rudo-rose" : "text-rudo-dark-text"}`}>
            {data.pendingModeration.toLocaleString()}
          </div>
          {data.pendingModeration > 0 ? (
            <div className="text-xs text-rudo-rose font-light">
              needs review
            </div>
          ) : (
            <div className="text-xs text-green-400 font-light">
              queue clear
            </div>
          )}
        </div>
      </div>

      {/* Secondary Stat Cards Row - 3 across */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-6 sm:mb-8">
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Total Likes
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text">
            {data.totalLikes.toLocaleString()}
          </div>
        </div>

        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Total Comments
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text">
            {data.totalComments.toLocaleString()}
          </div>
        </div>

        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Queue Health
          </div>
          <div className="flex items-baseline gap-3">
            <div className="font-instrument text-2xl text-rudo-dark-text">
              {data.queuedJobs.toLocaleString()}
            </div>
            <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
              queued
            </span>
            <span className="text-rudo-dark-muted/30">|</span>
            <div className={`font-instrument text-2xl ${data.failedJobs > 0 ? "text-rudo-rose" : "text-rudo-dark-text"}`}>
              {data.failedJobs.toLocaleString()}
            </div>
            <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
              failed
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Column - Recent Signups (wider) */}
        <div className="lg:col-span-3 bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
            Recent Signups
          </h3>

          {data.recentUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rudo-card-border">
                    <th className="text-left text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted pb-3 pr-4">
                      Name
                    </th>
                    <th className="text-left text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted pb-3 pr-4">
                      Email
                    </th>
                    <th className="text-left text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted pb-3 pr-4">
                      Tier
                    </th>
                    <th className="text-left text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted pb-3 pr-4">
                      Role
                    </th>
                    <th className="text-right text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted pb-3">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-rudo-card-border/50 last:border-b-0"
                    >
                      <td className="py-3 pr-4">
                        <span className="text-sm text-rudo-dark-text font-light">
                          {user.name || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm text-rudo-dark-text-sec font-light">
                          {user.email}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border ${
                            TIER_COLORS[user.tier] || TIER_COLORS.FREE
                          }`}
                        >
                          {user.tier}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border ${
                            ROLE_COLORS[user.role] || ROLE_COLORS.SPECTATOR
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
                          {timeAgo(new Date(user.createdAt))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-rudo-dark-text-sec font-light">
                No recent signups
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Users by Tier */}
        <div className="lg:col-span-2 bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
            Users by Tier
          </h3>

          {data.tierBreakdown.length > 0 ? (
            <div className="space-y-4">
              {data.tierBreakdown.map((tier) => (
                <div key={tier.tier}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-orbitron tracking-[2px] uppercase ${
                        tier.tier === "ADMIN"
                          ? "text-rudo-rose"
                          : tier.tier === "GRID"
                          ? "text-green-400"
                          : tier.tier === "PULSE"
                          ? "text-rudo-blue"
                          : tier.tier === "SPARK"
                          ? "text-yellow-400"
                          : "text-rudo-dark-muted"
                      }`}
                    >
                      {tier.tier}
                    </span>
                    <span className="text-sm font-instrument text-rudo-dark-text">
                      {tier.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-rudo-content-bg border border-rudo-card-border/50 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        TIER_BAR_COLORS[tier.tier] || TIER_BAR_COLORS.FREE
                      }`}
                      style={{
                        width: `${(tier.count / maxTierCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-rudo-dark-text-sec font-light">
                No tier data available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
