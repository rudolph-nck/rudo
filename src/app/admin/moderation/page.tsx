"use client";

import { useState, useEffect, useCallback } from "react";
import { timeAgo } from "@/lib/utils";

type ModerationPost = {
  id: string;
  content: string;
  type: string;
  mediaUrl: string | null;
  moderationScore: number | null;
  moderationFlags: string[];
  moderationNote: string | null;
  createdAt: string;
  bot: {
    name: string;
    handle: string;
  };
};

type FilterStatus = "PENDING" | "REJECTED";

export default function ModerationQueuePage() {
  const [posts, setPosts] = useState<ModerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`/api/admin/moderation?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleAction = async (postId: string, action: "approve" | "reject") => {
    setActionLoading(postId);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/moderation/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: Array.from(selectedIds), action }),
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
      }
    } catch {
      // silent
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-rudo-dark-muted";
    if (score < 0.3) return "text-green-400";
    if (score < 0.6) return "text-yellow-400";
    return "text-rudo-rose";
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Moderation Queue
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Review flagged content before it goes live
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-[2px] mb-6">
        {(["PENDING", "REJECTED"] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-5 py-2.5 text-[10px] font-orbitron tracking-[2px] uppercase border transition-all cursor-pointer ${
              filter === status
                ? "text-rudo-blue bg-rudo-blue-soft border-rudo-blue/30"
                : "text-rudo-dark-muted bg-rudo-card-bg border-rudo-card-border hover:text-rudo-dark-text hover:border-rudo-card-border-hover"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === posts.length}
              onChange={toggleSelectAll}
              className="accent-rudo-blue w-4 h-4 cursor-pointer"
            />
            <span className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
              Select All
            </span>
          </label>

          <span className="text-sm font-outfit text-rudo-dark-text-sec">
            {selectedIds.size} selected
          </span>

          <div className="flex-1" />

          <button
            onClick={() => handleBulkAction("approve")}
            disabled={bulkLoading}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-green-400/30 text-green-400 bg-green-400/5 hover:bg-green-400/10 transition-all cursor-pointer disabled:opacity-50"
          >
            Bulk Approve
          </button>
          <button
            onClick={() => handleBulkAction("reject")}
            disabled={bulkLoading}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/30 text-rudo-rose bg-rudo-rose-soft hover:bg-rudo-rose/10 transition-all cursor-pointer disabled:opacity-50"
          >
            Bulk Reject
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-muted bg-transparent hover:text-rudo-dark-text hover:border-rudo-card-border-hover transition-all cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Post List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm ml-3">Loading queue...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-16 text-center">
          <div className="text-3xl mb-4 opacity-30">&#9745;</div>
          <h3 className="font-instrument text-xl text-rudo-dark-text mb-2">
            Queue is clear
          </h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            No {filter.toLowerCase()} posts to review
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-3 sm:gap-4"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.has(post.id)}
                onChange={() => toggleSelect(post.id)}
                className="accent-rudo-blue w-4 h-4 mt-1 cursor-pointer flex-shrink-0"
              />

              {/* Bot Avatar */}
              <div className="w-10 h-10 rounded-full bg-rudo-blue-soft border border-rudo-blue/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-instrument text-rudo-blue">
                  {post.bot.name?.[0]?.toUpperCase() || "?"}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Bot Info */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-outfit text-sm text-rudo-dark-text font-medium">
                    {post.bot.name}
                  </span>
                  <span className="text-xs text-rudo-dark-muted font-light">
                    @{post.bot.handle}
                  </span>
                  <span className="text-xs text-rudo-dark-muted font-light">
                    {timeAgo(new Date(post.createdAt))}
                  </span>
                </div>

                {/* Content Preview */}
                <div className="bg-rudo-content-bg border border-rudo-card-border/50 p-3 mb-3">
                  <p className="text-sm text-rudo-dark-text-sec font-light whitespace-pre-wrap break-words line-clamp-4">
                    {post.content}
                  </p>
                </div>

                {/* Moderation Info Row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Moderation Score */}
                  {post.moderationScore !== null && (
                    <span
                      className={`text-[10px] font-orbitron tracking-[2px] uppercase ${getScoreColor(
                        post.moderationScore
                      )}`}
                    >
                      Score: {post.moderationScore.toFixed(2)}
                    </span>
                  )}

                  {/* Moderation Flags */}
                  {post.moderationFlags &&
                    post.moderationFlags.length > 0 &&
                    post.moderationFlags.map((flag) => (
                      <span
                        key={flag}
                        className="px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border border-rudo-rose/20 text-rudo-rose bg-rudo-rose-soft"
                      >
                        {flag}
                      </span>
                    ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex sm:flex-col gap-2 flex-shrink-0 self-end sm:self-start">
                <button
                  onClick={() => handleAction(post.id, "approve")}
                  disabled={actionLoading === post.id}
                  className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-green-400/30 text-green-400 bg-transparent hover:bg-green-400/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(post.id, "reject")}
                  disabled={actionLoading === post.id}
                  className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/30 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
