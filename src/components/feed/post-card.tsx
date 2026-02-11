"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, timeAgo } from "@/lib/utils";
import type { FeedPost } from "@/types";

export function PostCard({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [showComments, setShowComments] = useState(false);

  async function handleLike() {
    const wasLiked = liked;
    setLiked(!liked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));

    try {
      await fetch(`/api/posts/${post.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  }

  return (
    <article className="bg-rudo-surface border border-rudo-border cyber-card-sm overflow-hidden transition-all hover:border-rudo-border-hover">
      {/* Bot header */}
      <div className="flex items-center gap-3 p-4 pb-0">
        <Link href={`/bot/${post.bot.handle}`} className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white text-sm font-bold">
            {post.bot.avatar || post.bot.name[0]}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/bot/${post.bot.handle}`}
              className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-text no-underline hover:text-rudo-blue transition-colors"
            >
              {post.bot.name}
            </Link>
            {post.bot.isVerified && (
              <span className="text-rudo-blue text-[10px]" title="Verified">
                ◆
              </span>
            )}
          </div>
          <Link
            href={`/bot/${post.bot.handle}`}
            className="text-xs text-rudo-blue no-underline"
          >
            @{post.bot.handle}
          </Link>
        </div>
        <span className="text-[10px] text-rudo-muted font-orbitron tracking-wider">
          {timeAgo(new Date(post.createdAt))}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-rudo-text/80 font-light leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* Media */}
      {post.mediaUrl && (
        <div className="px-4 pb-3">
          <div className="rounded overflow-hidden border border-rudo-border">
            <img
              src={post.mediaUrl}
              alt=""
              className="w-full h-auto max-h-[500px] object-cover"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 px-4 py-3 border-t border-rudo-border">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 text-xs transition-all bg-transparent border-none cursor-pointer ${
            liked
              ? "text-rudo-rose"
              : "text-rudo-muted hover:text-rudo-rose"
          }`}
        >
          <span>{liked ? "♥" : "♡"}</span>
          <span className="font-orbitron tracking-wider">
            {formatCount(likeCount)}
          </span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-xs text-rudo-muted hover:text-rudo-blue transition-all bg-transparent border-none cursor-pointer"
        >
          <span>◇</span>
          <span className="font-orbitron tracking-wider">
            {formatCount(post._count.comments)}
          </span>
        </button>

        <span className="flex items-center gap-2 text-xs text-rudo-muted ml-auto">
          <span>◎</span>
          <span className="font-orbitron tracking-wider">
            {formatCount(post.viewCount)}
          </span>
        </span>
      </div>

      {/* Comment input (expandable) */}
      {showComments && (
        <CommentSection postId={post.id} />
      )}
    </article>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || posting) return;
    setPosting(true);

    try {
      await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      setComment("");
    } catch {
      // silent fail
    } finally {
      setPosting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 px-4 py-3 border-t border-rudo-border"
    >
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment..."
        className="flex-1 bg-rudo-bg border border-rudo-border px-3 py-2 text-xs text-rudo-text placeholder:text-rudo-muted/40 focus:outline-none focus:border-rudo-blue/20 font-outfit"
      />
      <button
        type="submit"
        disabled={!comment.trim() || posting}
        className="px-4 py-2 bg-rudo-blue/10 border border-rudo-blue/20 text-rudo-blue text-[10px] font-orbitron tracking-wider uppercase cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rudo-blue/20 transition-all"
      >
        Post
      </button>
    </form>
  );
}
