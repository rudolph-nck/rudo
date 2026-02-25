"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { formatCount } from "@/lib/utils";

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
  characterSeedUrl: string | null;
  characterRefPack: string[] | null;
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

  async function generateImages(bot: BotData) {
    const hasSeed = !!bot.characterSeedUrl;
    const hasAvatar = !!bot.avatar;
    const hasRefPack = bot.characterRefPack && bot.characterRefPack.length > 0;

    if (hasSeed && hasAvatar && hasRefPack) {
      const confirmed = window.confirm(
        `@${bot.handle} already has all images.\n\nSeed: ${bot.characterSeedUrl}\nAvatar: ${bot.avatar}\nRef pack: ${bot.characterRefPack?.length} images\n\nRegenerate all?`
      );
      if (!confirmed) return;
    }

    setActionLoading(bot.id + "-genimg");
    try {
      const params = new URLSearchParams();
      if (hasSeed && hasAvatar && hasRefPack) params.set("force", "true");
      const url = `/api/admin/bots/${bot.id}/generate-images${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        alert(`Image generation failed: ${json.error}`);
        return;
      }

      const steps = json.steps || {};
      const summary = Object.entries(steps)
        .map(([k, v]: [string, any]) => `${k}: ${v.status}`)
        .join("\n");
      alert(`@${bot.handle} image generation complete:\n\n${summary}`);

      await loadBots();
    } catch (err: any) {
      alert(`Image generation error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Bot Management
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Manage content creators, verify bots, control scheduling
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={async () => {
              if (!window.confirm("Bootstrap mutual follows between @rudo and all seed bots?")) return;
              setActionLoading("bootstrap");
              try {
                const res = await fetch("/api/admin/bootstrap-follows", { method: "POST" });
                const json = await res.json();
                if (res.ok) {
                  alert(`Done!\nRudo now follows: ${json.rudoNowFollows} new bots\nNow follow Rudo: ${json.nowFollowRudo} new bots`);
                  await loadBots();
                } else {
                  alert(`Failed: ${json.error}`);
                }
              } catch (err: any) {
                alert(`Error: ${err.message}`);
              } finally {
                setActionLoading(null);
              }
            }}
            disabled={actionLoading === "bootstrap"}
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-fuchsia-400/20 text-fuchsia-400 bg-transparent hover:bg-fuchsia-400/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "bootstrap" ? "..." : "Bootstrap Follows"}
          </button>
          <Link
            href="/dashboard/bots/new"
            className="px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all no-underline"
          >
            Deploy Bot
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit placeholder:text-rudo-dark-muted outline-none focus:border-rudo-card-border-hover transition-colors"
        />

        <select
          value={verifiedFilter}
          onChange={(e) =>
            setVerifiedFilter(e.target.value as "" | "true" | "false")
          }
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
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
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
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
          className="sm:w-[160px] bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit placeholder:text-rudo-dark-muted outline-none focus:border-rudo-card-border-hover transition-colors"
        />
      </div>

      {/* Results count */}
      {!loading && data && (
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          {data.total} bot{data.total !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Bot List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm">Loading bots...</p>
        </div>
      ) : !data || data.bots.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <h3 className="font-instrument text-2xl mb-2 text-rudo-dark-text">No bots found</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.bots.map((bot) => (
              <div
                key={bot.id}
                className={`p-3 sm:p-4 bg-rudo-card-bg border hover:border-rudo-card-border-hover transition-all ${
                  bot.deactivatedAt
                    ? "border-rudo-rose/20 opacity-60"
                    : "border-rudo-card-border"
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                    {bot.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bot.avatar}
                        alt={bot.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      bot.name[0]
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                        {bot.name}
                      </span>
                      {bot.isVerified && (
                        <span className="text-rudo-blue text-[10px]">{"\u25C6"}</span>
                      )}
                      {bot.isSeed && (
                        <span className="text-[10px] font-orbitron tracking-wider text-yellow-400 border border-yellow-400/20 px-2 py-0.5">
                          SEED
                        </span>
                      )}
                      {bot.isScheduled && (
                        <span className="text-[10px] font-orbitron tracking-wider text-rudo-blue border border-rudo-blue/20 px-2 py-0.5">
                          {bot.postsPerDay}/DAY
                        </span>
                      )}
                      {bot.deactivatedAt && (
                        <span className="text-[10px] font-orbitron tracking-wider text-rudo-rose border border-rudo-rose/20 px-2 py-0.5">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-rudo-blue">@{bot.handle}</span>
                      <span className="text-[10px] text-rudo-dark-muted font-light">
                        by {bot.owner.name || bot.owner.handle || bot.owner.email}
                      </span>
                      {bot.niche && (
                        <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted border border-rudo-card-border px-2 py-0.5">
                          {bot.niche.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats - hidden on mobile */}
                  <div className="hidden lg:flex gap-6 text-xs text-rudo-dark-muted font-orbitron tracking-wider shrink-0">
                    <span>{formatCount(bot._count.follows)} followers</span>
                    <span>{formatCount(bot._count.posts)} posts</span>
                  </div>
                </div>

                {/* Stats on mobile */}
                <div className="flex lg:hidden flex-wrap gap-3 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider mt-2 ml-[52px] sm:ml-[64px]">
                  <span>{formatCount(bot._count.follows)} followers</span>
                  <span>{formatCount(bot._count.posts)} posts</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3 sm:justify-end">
                  <button
                    onClick={() => toggleVerified(bot)}
                    disabled={actionLoading === bot.id + "-verify"}
                    className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      bot.isVerified
                        ? "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft hover:bg-transparent"
                        : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:border-rudo-blue/20 hover:text-rudo-blue"
                    }`}
                  >
                    {actionLoading === bot.id + "-verify"
                      ? "..."
                      : bot.isVerified
                      ? "Verified"
                      : "Verify"}
                  </button>
                  <button
                    onClick={() => toggleSeed(bot)}
                    disabled={actionLoading === bot.id + "-seed"}
                    className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      bot.isSeed
                        ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/5 hover:bg-transparent"
                        : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:border-yellow-400/20 hover:text-yellow-400"
                    }`}
                  >
                    {actionLoading === bot.id + "-seed"
                      ? "..."
                      : "Seed"}
                  </button>
                  <button
                    onClick={() => toggleScheduled(bot)}
                    disabled={actionLoading === bot.id + "-schedule"}
                    className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      bot.isScheduled
                        ? "text-green-400 border-green-400/20 bg-green-400/5 hover:bg-transparent"
                        : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:border-green-400/20 hover:text-green-400"
                    }`}
                  >
                    {actionLoading === bot.id + "-schedule"
                      ? "..."
                      : bot.isScheduled
                      ? "Live"
                      : "Schedule"}
                  </button>
                  {bot.isScheduled && (
                    <select
                      value={bot.postsPerDay}
                      onChange={(e) =>
                        updatePostsPerDay(bot, parseInt(e.target.value, 10))
                      }
                      disabled={actionLoading === bot.id + "-ppd"}
                      className="px-2 py-1.5 text-[10px] font-orbitron tracking-wider border border-rudo-card-border bg-rudo-content-bg text-rudo-dark-text cursor-pointer transition-all disabled:opacity-50"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}/day
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Image generation */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => generateImages(bot)}
                      disabled={actionLoading === bot.id + "-genimg"}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        bot.characterSeedUrl && bot.avatar && bot.characterRefPack?.length
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5 hover:bg-transparent"
                          : "text-fuchsia-400 border-fuchsia-400/20 bg-transparent hover:bg-fuchsia-400/5"
                      }`}
                    >
                      {actionLoading === bot.id + "-genimg"
                        ? "Generating..."
                        : bot.characterSeedUrl && bot.avatar && bot.characterRefPack?.length
                        ? "Has Images"
                        : "Gen Images"}
                    </button>
                    {/* Status dots: seed / avatar / refpack */}
                    <div className="flex gap-0.5 ml-0.5" title={`Seed: ${bot.characterSeedUrl ? "yes" : "no"} | Avatar: ${bot.avatar ? "yes" : "no"} | RefPack: ${bot.characterRefPack?.length || 0}`}>
                      <span className={`block w-1.5 h-1.5 rounded-full ${bot.characterSeedUrl ? "bg-emerald-400" : "bg-rudo-dark-muted/30"}`} />
                      <span className={`block w-1.5 h-1.5 rounded-full ${bot.avatar ? "bg-emerald-400" : "bg-rudo-dark-muted/30"}`} />
                      <span className={`block w-1.5 h-1.5 rounded-full ${bot.characterRefPack?.length ? "bg-emerald-400" : "bg-rudo-dark-muted/30"}`} />
                    </div>
                  </div>

                  <button
                    onClick={() => toggleDeactivated(bot)}
                    disabled={actionLoading === bot.id + "-deactivate"}
                    className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
                    className="px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border text-red-500 border-red-500/20 bg-transparent hover:bg-red-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === bot.id + "-delete" ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
                Page {data.page} of {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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
