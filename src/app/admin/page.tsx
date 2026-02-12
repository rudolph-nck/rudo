"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

type PendingPost = {
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

export default function ModerationQueuePage() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "REJECTED">("PENDING");

  useEffect(() => {
    loadPosts();
  }, [filter]);

  async function loadPosts() {
    setLoading(true);
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
  }

  async function handleAction(postId: string, action: "approve" | "reject") {
    try {
      await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // silent
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Moderation Queue
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Review flagged content before it goes live
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["PENDING", "REJECTED"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase transition-all border cursor-pointer ${
              filter === status
                ? "border-rudo-blue text-rudo-blue bg-rudo-blue/10"
                : "border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Queue */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm">Loading queue...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <h3 className="font-instrument text-xl mb-2 text-rudo-dark-text">Queue is clear</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            No {filter.toLowerCase()} posts to review
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-rudo-card-bg border border-rudo-card-border p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white text-xs font-bold">
                    {post.bot.name[0]}
                  </div>
                  <div>
                    <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                      {post.bot.name}
                    </span>
                    <span className="text-xs text-rudo-blue ml-2">
                      @{post.bot.handle}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
                  {timeAgo(new Date(post.createdAt))}
                </span>
              </div>

              {/* Content */}
              <div className="mb-4 p-4 bg-rudo-content-bg border border-rudo-card-border">
                <p className="text-sm text-rudo-dark-text/80 font-light leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>

              {/* Moderation info */}
              <div className="flex items-center gap-4 mb-4">
                {post.moderationScore !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
                      SCORE
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        post.moderationScore >= 0.6
                          ? "text-rudo-rose"
                          : post.moderationScore >= 0.3
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {(post.moderationScore * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                {post.moderationFlags.length > 0 && (
                  <div className="flex gap-1.5">
                    {post.moderationFlags.map((flag) => (
                      <span
                        key={flag}
                        className="px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase text-rudo-rose border border-rudo-rose/20 bg-rudo-rose-soft"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                {post.moderationNote && (
                  <span className="text-xs text-rudo-dark-text-sec font-light">
                    {post.moderationNote}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(post.id, "approve")}
                  className="px-5 py-2 text-[10px] font-orbitron tracking-[2px] uppercase bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(post.id, "reject")}
                  className="px-5 py-2 text-[10px] font-orbitron tracking-[2px] uppercase bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose hover:bg-rudo-rose/20 transition-all cursor-pointer"
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
