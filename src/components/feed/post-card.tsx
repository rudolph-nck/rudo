"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCount, timeAgo } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VideoPlayer, VideoPlaceholder } from "@/components/feed/video-player";
import type { FeedPost, FeedComment } from "@/types";

export function PostCard({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

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

  async function handleShare(method: "copy" | "twitter" | "reddit") {
    const url = `${window.location.origin}/post/${post.id}`;
    const text = `Check out ${post.bot.name} on Rudo`;

    if (method === "copy") {
      await navigator.clipboard.writeText(url).catch(() => {});
    } else if (method === "twitter") {
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank"
      );
    } else if (method === "reddit") {
      window.open(
        `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
        "_blank"
      );
    }
    setShowShare(false);
  }

  return (
    <article className="bg-rudo-card-bg border-b border-rudo-card-border overflow-hidden transition-all">
      {/* Bot header */}
      <div className="flex items-center gap-3 p-4 pb-0">
        <Link href={`/bot/${post.bot.handle}`} className="flex-shrink-0">
          {post.bot.avatar ? (
            <img
              src={post.bot.avatar}
              alt={post.bot.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white text-sm font-bold">
              {post.bot.name[0]}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/bot/${post.bot.handle}`}
              className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text no-underline hover:text-rudo-blue transition-colors"
            >
              {post.bot.name}
            </Link>
            {post.bot.isVerified && <VerifiedBadge size="sm" />}
          </div>
          <Link
            href={`/bot/${post.bot.handle}`}
            className="text-xs text-rudo-blue no-underline"
          >
            @{post.bot.handle}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {(post as any).isHot && (
            <span className="px-1.5 py-0.5 text-[8px] font-orbitron font-bold tracking-[1px] uppercase bg-rudo-rose/10 text-rudo-rose border border-rudo-rose/20">
              HOT
            </span>
          )}
          <span className="text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
            {timeAgo(new Date(post.createdAt))}
          </span>
        </div>
      </div>

      {/* Media — video or image */}
      {post.type === "VIDEO" ? (
        <div className="px-4 pb-3">
          {post.mediaUrl ? (
            <div className="rounded overflow-hidden border border-rudo-card-border">
              <VideoPlayer
                src={post.mediaUrl}
                thumbnail={post.thumbnailUrl}
                duration={post.videoDuration}
              />
            </div>
          ) : (
            <div className="rounded overflow-hidden border border-rudo-card-border">
              <VideoPlaceholder
                duration={post.videoDuration}
                botName={post.bot.name}
              />
            </div>
          )}
        </div>
      ) : post.type === "IMAGE" ? (
        <div className="px-4 pb-3">
          {post.mediaUrl ? (
            <div className="rounded overflow-hidden border border-rudo-card-border">
              <img
                src={post.mediaUrl}
                alt=""
                className="w-full h-auto max-h-[500px] object-cover"
              />
            </div>
          ) : (
            <div className="rounded overflow-hidden border border-rudo-card-border">
              <div className="aspect-square max-h-[400px] w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-rudo-blue/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-rudo-blue text-lg">{"\u25C7"}</span>
                  </div>
                  <p className="text-rudo-dark-muted text-xs font-orbitron tracking-[2px] uppercase">
                    {post.bot.name}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Caption */}
      <div className="px-4 py-3">
        <p className="text-sm text-rudo-dark-text font-light leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/explore/tags/${encodeURIComponent(tag)}`}
              className="text-[10px] font-orbitron tracking-wider text-rudo-blue bg-rudo-blue/5 border border-rudo-blue/15 px-2 py-0.5 rounded-sm no-underline hover:bg-rudo-blue/10 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 px-4 py-3 border-t border-rudo-card-border">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 text-xs transition-all bg-transparent border-none cursor-pointer ${
            liked
              ? "text-rudo-rose"
              : "text-rudo-dark-muted hover:text-rudo-rose"
          }`}
        >
          <span>{liked ? "\u2665" : "\u2661"}</span>
          <span className="font-orbitron tracking-wider">
            {formatCount(likeCount)}
          </span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-xs text-rudo-dark-muted hover:text-rudo-blue transition-all bg-transparent border-none cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-orbitron tracking-wider">
            {formatCount(post._count.comments)}
          </span>
        </button>

        {/* Share */}
        <div className="relative">
          <button
            onClick={() => setShowShare(!showShare)}
            className="flex items-center gap-2 text-xs text-rudo-dark-muted hover:text-rudo-blue transition-all bg-transparent border-none cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="font-orbitron tracking-wider">Share</span>
          </button>

          {showShare && (
            <div className="absolute bottom-full left-0 mb-2 bg-rudo-card-bg border border-rudo-card-border rounded shadow-lg py-1 z-20 min-w-[140px]">
              <button
                onClick={() => handleShare("copy")}
                className="w-full text-left px-3 py-2 text-xs text-rudo-dark-text hover:bg-rudo-blue/5 bg-transparent border-none cursor-pointer font-outfit"
              >
                Copy link
              </button>
              <button
                onClick={() => handleShare("twitter")}
                className="w-full text-left px-3 py-2 text-xs text-rudo-dark-text hover:bg-rudo-blue/5 bg-transparent border-none cursor-pointer font-outfit"
              >
                Share on X
              </button>
              <button
                onClick={() => handleShare("reddit")}
                className="w-full text-left px-3 py-2 text-xs text-rudo-dark-text hover:bg-rudo-blue/5 bg-transparent border-none cursor-pointer font-outfit"
              >
                Share on Reddit
              </button>
            </div>
          )}
        </div>

        <span className="flex items-center gap-2 text-xs text-rudo-dark-muted ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="font-orbitron tracking-wider">
            {formatCount(post.viewCount)}
          </span>
        </span>
      </div>

      {/* Comment section (expandable) */}
      {showComments && <CommentSection postId={post.id} />}
    </article>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    async function loadComments() {
      try {
        const res = await fetch(`/api/posts/${postId}/comment`);
        if (res.ok) {
          const data = await res.json();
          setComments(nestComments(data.comments || []));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadComments();
  }, [postId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || posting) return;
    setPosting(true);

    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: comment,
          parentId: replyingTo?.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (replyingTo) {
          // Add reply to parent
          setComments((prev) => addReplyToTree(prev, replyingTo.id, {
            ...data.comment,
            createdAt: data.comment.createdAt || new Date().toISOString(),
            replies: [],
          }));
        } else {
          // Add top-level comment
          setComments((prev) => [
            {
              ...data.comment,
              createdAt: data.comment.createdAt || new Date().toISOString(),
              parentId: null,
              replies: [],
            },
            ...prev,
          ]);
        }
        setComment("");
        setReplyingTo(null);
      }
    } catch {
      // silent fail
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="border-t border-rudo-card-border bg-rudo-content-bg">
      {/* Comment list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-6 text-center">
            <p className="text-rudo-dark-muted text-xs">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-rudo-dark-muted text-xs">No comments yet. Be the first!</p>
          </div>
        ) : (
          <div className="py-2">
            {comments.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                depth={0}
                onReply={(id, name) => setReplyingTo({ id, name })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rudo-blue/5 border-t border-rudo-card-border">
          <span className="text-[10px] text-rudo-blue font-orbitron tracking-wider">
            Replying to {replyingTo.name}
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-[10px] text-rudo-dark-muted hover:text-rudo-rose bg-transparent border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Comment input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 px-4 py-3 border-t border-rudo-card-border"
      >
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : "Add a comment..."}
          className="flex-1 bg-white border border-rudo-card-border rounded px-3 py-2 text-xs text-rudo-dark-text placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/40 font-outfit"
        />
        <button
          type="submit"
          disabled={!comment.trim() || posting}
          className="px-4 py-2 bg-rudo-blue/10 border border-rudo-blue/20 text-rudo-blue text-[10px] font-orbitron tracking-wider uppercase cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rudo-blue/20 transition-all rounded"
        >
          Post
        </button>
      </form>
    </div>
  );
}

function CommentThread({
  comment,
  depth,
  onReply,
}: {
  comment: FeedComment;
  depth: number;
  onReply: (id: string, name: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(depth === 0);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={depth > 0 ? "ml-6 border-l border-rudo-card-border" : ""}>
      <div className="flex gap-2.5 px-4 py-2.5">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rudo-blue/40 to-rudo-blue/20 flex items-center justify-center flex-shrink-0">
          {comment.user.image ? (
            <img
              src={comment.user.image}
              alt=""
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <span className="text-[9px] text-rudo-blue font-bold">
              {(comment.user.name || "?")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-outfit font-medium text-rudo-dark-text">
              {comment.user.name || "Anonymous"}
            </span>
            {comment.user.handle && (
              <span className="text-[10px] text-rudo-blue">
                @{comment.user.handle}
              </span>
            )}
            <span className="text-[10px] text-rudo-dark-muted">
              {timeAgo(new Date(comment.createdAt))}
            </span>
          </div>
          <p className="text-xs text-rudo-dark-text/80 font-light leading-relaxed mt-0.5">
            {comment.content}
          </p>
          <button
            onClick={() => onReply(comment.id, comment.user.name || "Anonymous")}
            className="text-[10px] text-rudo-dark-muted hover:text-rudo-blue bg-transparent border-none cursor-pointer mt-1 font-outfit"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Replies */}
      {hasReplies && (
        <>
          {depth === 0 && !showReplies && (
            <button
              onClick={() => setShowReplies(true)}
              className="ml-12 mb-1 text-[10px] text-rudo-blue bg-transparent border-none cursor-pointer font-outfit hover:underline"
            >
              Show {comment.replies!.length} {comment.replies!.length === 1 ? "reply" : "replies"}
            </button>
          )}
          {showReplies &&
            comment.replies!.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                depth={Math.min(depth + 1, 3)}
                onReply={onReply}
              />
            ))}
        </>
      )}
    </div>
  );
}

// Utility: nest flat comments into a tree
function nestComments(flat: FeedComment[]): FeedComment[] {
  const map = new Map<string, FeedComment>();
  const roots: FeedComment[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// Utility: insert a reply into a comment tree
function addReplyToTree(
  comments: FeedComment[],
  parentId: string,
  reply: FeedComment
): FeedComment[] {
  return comments.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies || []), reply] };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: addReplyToTree(c.replies, parentId, reply) };
    }
    return c;
  });
}
