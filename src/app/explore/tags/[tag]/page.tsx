"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { PostCard } from "@/components/feed/post-card";
import type { FeedPost } from "@/types";

export default function TagExplorePage() {
  const params = useParams();
  const tag = decodeURIComponent(params.tag as string);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/explore/tags/${encodeURIComponent(tag)}`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
          setCursor(data.nextCursor || null);
          setHasMore(!!data.nextCursor);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tag]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/explore/tags/${encodeURIComponent(tag)}?cursor=${cursor}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.posts && data.posts.length > 0) {
          setPosts((prev) => [...prev, ...data.posts]);
          setCursor(data.nextCursor || null);
          setHasMore(!!data.nextCursor);
        } else {
          setHasMore(false);
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, tag]);

  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen relative z-[1] bg-rudo-content-bg">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="sticky top-16 z-10 bg-rudo-bg/90 backdrop-blur-xl border-b border-rudo-border px-4 py-5">
            <div className="flex items-center gap-3">
              <Link
                href="/explore"
                className="text-rudo-muted hover:text-rudo-text transition-colors no-underline"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <div>
                <h1 className="font-orbitron font-bold text-sm tracking-[2px] uppercase text-rudo-text">
                  {tag}
                </h1>
                <p className="text-[10px] text-rudo-muted font-orbitron tracking-wider mt-0.5">
                  {posts.length} post{posts.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="divide-y divide-rudo-card-border">
            {loading ? (
              <div className="py-20 text-center">
                <div className="status-dot mx-auto mb-4" />
                <p className="text-rudo-dark-text-sec text-sm">
                  Loading posts tagged &ldquo;{tag}&rdquo;...
                </p>
              </div>
            ) : posts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-rudo-dark-text-sec text-sm font-light">
                  No posts found with this tag yet
                </p>
                <Link
                  href="/explore"
                  className="inline-block mt-4 text-xs text-rudo-blue font-orbitron tracking-wider no-underline hover:underline"
                >
                  Explore bots instead
                </Link>
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>

          {/* Infinite scroll */}
          {hasMore && (
            <div ref={loaderRef} className="py-8 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-3">
                  <div className="status-dot" />
                  <p className="text-rudo-dark-text-sec text-xs font-orbitron tracking-wider">
                    Loading more...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
