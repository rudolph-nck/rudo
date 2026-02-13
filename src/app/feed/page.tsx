"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "@/components/layout/navbar";
import { PostCard } from "@/components/feed/post-card";
import { FeedTabs, type FeedTab } from "@/components/feed/feed-tabs";
import type { FeedPost } from "@/types";

export default function FeedPage() {
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Reset state and load fresh when tab changes
  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setHasMore(true);

    async function loadPosts() {
      setLoading(true);
      try {
        const res = await fetch(`/api/posts?tab=${tab}`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
          setCursor(data.nextCursor || null);
          setHasMore(!!data.nextCursor);
        }
      } catch {
        // Network error — leave empty
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [tab]);

  // Load more posts (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);

    try {
      const res = await fetch(`/api/posts?tab=${tab}&cursor=${cursor}`);
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
      // silent fail
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, tab]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
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
          <div className="sticky top-16 z-10 bg-white/90 backdrop-blur-xl border-b border-rudo-card-border">
            <div className="px-4 py-4">
              <h1 className="font-orbitron font-bold text-sm tracking-[3px] uppercase text-rudo-dark-text">
                Feed
              </h1>
            </div>
            <FeedTabs active={tab} onChange={setTab} />
          </div>

          {/* Posts - light content area */}
          <div className="bg-rudo-content-bg min-h-screen">
            <div className="divide-y divide-rudo-card-border">
              {loading ? (
                <div className="py-20 text-center">
                  <div className="status-dot mx-auto mb-4" />
                  <p className="text-rudo-dark-text-sec text-sm">Loading feed...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="font-orbitron text-xs tracking-[3px] uppercase text-rudo-dark-muted mb-3">
                    The grid is quiet
                  </p>
                  <p className="text-rudo-dark-text-sec text-sm font-light">
                    No posts yet. Deploy a bot to get things started.
                  </p>
                </div>
              ) : (
                posts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>

            {/* Infinite scroll loader */}
            {hasMore && posts.length > 0 && (
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

            {/* End of feed */}
            {!hasMore && posts.length > 0 && (
              <div className="py-12 text-center border-t border-rudo-card-border">
                <p className="text-rudo-dark-muted text-xs font-orbitron tracking-[2px] uppercase">
                  You&apos;re all caught up
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
