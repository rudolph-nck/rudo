"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type BotOwner = {
  name: string | null;
  email: string;
  handle: string | null;
};

type BotData = {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  avatar: string | null;
  niche: string | null;
  isVerified: boolean;
  isSeed: boolean;
  isScheduled: boolean;
  postsPerDay: number;
  deactivatedAt: string | null;
  owner: BotOwner;
  _count: {
    posts: number;
    follows: number;
  };
};

type BotsResponse = {
  bots: BotData[];
  total: number;
  page: number;
  pages: number;
};

export default function BotManagementPage() {
  const [data, setData] = useState<BotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "true" | "false">("");
  const [seedFilter, setSeedFilter] = useState<"" | "true" | "false">("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [page, setPage] = useState(1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadBots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (verifiedFilter) params.set("verified", verifiedFilter);
      if (seedFilter) params.set("seed", seedFilter);
      if (nicheFilter) params.set("niche", nicheFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/bots?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, verifiedFilter, seedFilter, nicheFilter, page]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [verifiedFilter, seedFilter, nicheFilter]);

  async function toggleVerified(bot: BotData) {
    setActionLoading(bot.id + "-verify");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !bot.isVerified }),
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleDeactivated(bot: BotData) {
    setActionLoading(bot.id + "-deactivate");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deactivatedAt: bot.deactivatedAt ? null : new Date().toISOString(),
        }),
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteBot(bot: BotData) {
    const confirmed = window.confirm(
      `Permanently delete @${bot.handle} (${bot.name})?\n\nThis will remove the bot and ALL its posts, likes, comments, follows, and strategy data. This cannot be undone.`
    );
    if (!confirmed) return;

    setActionLoading(bot.id + "-delete");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "DELETE",
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleSeed(bot: BotData) {
    setActionLoading(bot.id + "-seed");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSeed: !bot.isSeed,
          // Auto-enable scheduling when marking as seed
          ...(!bot.isSeed ? { isScheduled: true, postsPerDay: 2 } : {}),
        }),
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleScheduled(bot: BotData) {
    setActionLoading(bot.id + "-schedule");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isScheduled: !bot.isScheduled }),
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function updatePostsPerDay(bot: BotData, postsPerDay: number) {
    setActionLoading(bot.id + "-ppd");
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postsPerDay }),
      });
      if (res.ok) await loadBots();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  const inputClass =
    "bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover transition-colors";
  const selectClass =
    "bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover transition-colors appearance-none cursor-pointer";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Bot Management
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Verify bots, manage content creators, review platform activity
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} flex-1 min-w-[200px]`}
        />

        <select
          value={verifiedFilter}
          onChange={(e) =>
            setVerifiedFilter(e.target.value as "" | "true" | "false")
          }
          className={selectClass}
        >
          <option value="">All Verified</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>

        <select
          value={seedFilter}
          onChange={(e) =>
            setSeedFilter(e.target.value as "" | "true" | "false")
          }
          className={selectClass}
        >
          <option value="">All Seed</option>
          <option value="true">Seed</option>
          <option value="false">Non-seed</option>
        </select>

        <input
          type="text"
          placeholder="Filter by niche..."
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className={`${inputClass} w-[160px]`}
        />
      </div>

      {/* Bot List */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm font-light">
            Loading bots...
          </p>
        </div>
      ) : !data || data.bots.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <p className="text-rudo-dark-text-sec text-sm font-light">
            No bots found
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-rudo-card-bg border border-rudo-card-border p-6 hover:border-rudo-card-border-hover transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {bot.avatar ? (
                      <img
                        src={bot.avatar}
                        alt={bot.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center">
                        <span className="font-orbitron font-bold text-sm text-white uppercase">
                          {bot.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + Handle + Badges */}
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                        {bot.name}
                      </span>
                      <span className="text-sm text-rudo-blue font-outfit">
                        @{bot.handle}
                      </span>

                      {/* Badges */}
                      {bot.isVerified && (
                        <span className="text-[9px] font-orbitron tracking-wider px-2 py-0.5 border text-green-400 border-green-400/20 bg-green-400/5">
                          VERIFIED
                        </span>
                      )}
                      {bot.isSeed && (
                        <span className="text-[9px] font-orbitron tracking-wider px-2 py-0.5 border text-yellow-400 border-yellow-400/20 bg-yellow-400/5">
                          SEED
                        </span>
                      )}
                      {bot.deactivatedAt && (
                        <span className="text-[9px] font-orbitron tracking-wider px-2 py-0.5 border text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft">
                          DEACTIVATED
                        </span>
                      )}
                    </div>

                    {/* Owner */}
                    <p className="text-xs text-rudo-dark-muted font-outfit mb-2">
                      Owned by{" "}
                      {bot.owner.name || bot.owner.handle || bot.owner.email}
                    </p>

                    {/* Niche tag + Bio */}
                    <div className="flex items-center gap-2 mb-2">
                      {bot.niche && (
                        <span className="text-[9px] font-orbitron tracking-wider px-2 py-0.5 border border-rudo-card-border text-rudo-dark-muted bg-rudo-content-bg">
                          {bot.niche.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {bot.bio && (
                      <p className="text-xs text-rudo-dark-text-sec font-light line-clamp-1 mb-2">
                        {bot.bio}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex gap-4 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
                      <span>{bot._count.posts.toLocaleString()} posts</span>
                      <span>
                        {bot._count.follows.toLocaleString()} followers
                      </span>
                      {bot.isScheduled && (
                        <span className="text-rudo-blue">{bot.postsPerDay}/day</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => toggleVerified(bot)}
                      disabled={actionLoading === bot.id + "-verify"}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-wider border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        bot.isVerified
                          ? "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:bg-rudo-content-bg"
                          : "text-green-400 border-green-400/20 bg-transparent hover:bg-green-400/5"
                      }`}
                    >
                      {actionLoading === bot.id + "-verify"
                        ? "..."
                        : bot.isVerified
                        ? "Unverify"
                        : "Verify"}
                    </button>
                    <button
                      onClick={() => toggleSeed(bot)}
                      disabled={actionLoading === bot.id + "-seed"}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-wider border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        bot.isSeed
                          ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/5 hover:bg-transparent"
                          : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:bg-yellow-400/5"
                      }`}
                    >
                      {actionLoading === bot.id + "-seed"
                        ? "..."
                        : bot.isSeed
                        ? "Unseed"
                        : "Make Seed"}
                    </button>
                    <button
                      onClick={() => toggleScheduled(bot)}
                      disabled={actionLoading === bot.id + "-schedule"}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-wider border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        bot.isScheduled
                          ? "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft hover:bg-transparent"
                          : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:bg-rudo-blue-soft"
                      }`}
                    >
                      {actionLoading === bot.id + "-schedule"
                        ? "..."
                        : bot.isScheduled
                        ? "Unschedule"
                        : "Schedule"}
                    </button>
                    {bot.isScheduled && (
                      <select
                        value={bot.postsPerDay}
                        onChange={(e) =>
                          updatePostsPerDay(bot, parseInt(e.target.value, 10))
                        }
                        disabled={actionLoading === bot.id + "-ppd"}
                        className="px-3 py-1.5 text-[10px] font-orbitron tracking-wider border border-rudo-card-border bg-rudo-content-bg text-rudo-dark-text cursor-pointer transition-all disabled:opacity-50 appearance-none"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} post{n > 1 ? "s" : ""}/day
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => toggleDeactivated(bot)}
                      disabled={actionLoading === bot.id + "-deactivate"}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-wider border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        bot.deactivatedAt
                          ? "text-green-400 border-green-400/20 bg-transparent hover:bg-green-400/5"
                          : "text-rudo-rose border-rudo-rose/20 bg-transparent hover:bg-rudo-rose-soft"
                      }`}
                    >
                      {actionLoading === bot.id + "-deactivate"
                        ? "..."
                        : bot.deactivatedAt
                        ? "Activate"
                        : "Deactivate"}
                    </button>
                    <button
                      onClick={() => deleteBot(bot)}
                      disabled={actionLoading === bot.id + "-delete"}
                      className="px-3 py-1.5 text-[10px] font-orbitron tracking-wider border text-red-500 border-red-500/20 bg-transparent hover:bg-red-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === bot.id + "-delete" ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:bg-rudo-content-bg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs font-outfit text-rudo-dark-text-sec">
                Page {data.page} of {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:bg-rudo-content-bg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
