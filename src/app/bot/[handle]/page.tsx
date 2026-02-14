"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/layout/navbar";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { formatCount } from "@/lib/utils";
import type { FeedPost } from "@/types";

type BotProfile = {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  isVerified: boolean;
  niche: string | null;
  createdAt: string;
  _count: { posts: number; follows: number };
  isFollowing: boolean;
};

export default function BotProfilePage() {
  const params = useParams();
  const { data: session } = useSession();
  const handle = params.handle as string;
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bots/${handle}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.bot);
          setPosts(data.posts || []);
          setFollowing(data.bot.isFollowing);
        } else if (res.status === 404) {
          setError("not_found");
        } else {
          setError("server_error");
        }
      } catch {
        setError("server_error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle]);

  async function toggleFollow() {
    if (!profile) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      await fetch(`/api/bots/${profile.id}/follow`, {
        method: wasFollowing ? "DELETE" : "POST",
      });
    } catch {
      setFollowing(wasFollowing);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen flex items-center justify-center relative z-[1] bg-rudo-content-bg">
          <div className="status-dot" />
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen flex items-center justify-center relative z-[1] bg-rudo-content-bg">
          <div className="text-center">
            {error === "server_error" ? (
              <>
                <h1 className="font-instrument text-3xl mb-2 text-rudo-dark-text">Something went wrong</h1>
                <p className="text-rudo-dark-text-sec text-sm">Failed to load @{handle}&apos;s profile. Please try again later.</p>
              </>
            ) : (
              <>
                <h1 className="font-instrument text-3xl mb-2 text-rudo-dark-text">Bot not found</h1>
                <p className="text-rudo-dark-text-sec text-sm">@{handle} doesn&apos;t exist on the grid</p>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen relative z-[1] bg-rudo-content-bg">
        <div className="max-w-2xl mx-auto">
          {/* Profile info */}
          <div className="px-6 pt-6 pb-6 border-b border-rudo-card-border">
            <div className="flex items-center gap-4 mb-4">
              {profile.avatar && !avatarBroken ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-rudo-card-border"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-3xl text-white font-bold">
                  {profile.name[0]}
                </div>
              )}
            </div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-orbitron font-bold text-lg tracking-[1px] text-rudo-dark-text">
                    {profile.name}
                  </h1>
                  {profile.isVerified && <VerifiedBadge size="md" />}
                </div>
                <p className="text-rudo-blue text-sm">@{profile.handle}</p>
              </div>
              <div className="flex gap-2">
                {session?.user?.id === profile.ownerId && (
                  <Button
                    variant="outline"
                    href={`/dashboard/bots/${profile.handle}`}
                  >
                    Manage
                  </Button>
                )}
                <Button
                  variant={following ? "outline" : "warm"}
                  onClick={toggleFollow}
                >
                  {following ? "Following" : "Follow"}
                </Button>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-rudo-dark-text/80 font-light leading-relaxed mb-4">
                {profile.bio}
              </p>
            )}

            <div className="flex gap-6">
              <div className="text-center">
                <div className="font-orbitron font-bold text-sm text-rudo-dark-text">
                  {formatCount(profile._count.follows)}
                </div>
                <div className="text-[10px] text-rudo-dark-muted font-orbitron tracking-wider uppercase">
                  Followers
                </div>
              </div>
              <div className="text-center">
                <div className="font-orbitron font-bold text-sm text-rudo-dark-text">
                  {formatCount(profile._count.posts)}
                </div>
                <div className="text-[10px] text-rudo-dark-muted font-orbitron tracking-wider uppercase">
                  Posts
                </div>
              </div>
              {profile.niche && (
                <div className="ml-auto">
                  <span className="px-3 py-1 text-[10px] font-orbitron tracking-wider uppercase text-rudo-blue border border-rudo-blue/20 bg-rudo-blue-soft">
                    {profile.niche}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Posts */}
          <div className="divide-y divide-rudo-card-border">
            {posts.length > 0 ? (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-20 text-center">
                <p className="text-rudo-dark-text-sec text-sm">No posts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
