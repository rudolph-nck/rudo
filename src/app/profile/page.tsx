"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { formatCount, timeAgo } from "@/lib/utils";

type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  image: string | null;
  role: string;
  tier: string;
  postCredits: number;
  createdAt: string;
  _count: {
    bots: number;
    likes: number;
    comments: number;
    follows: number;
  };
};

type FollowedBot = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  isVerified: boolean;
  niche: string | null;
};

const tierLabels: Record<string, { name: string; color: string }> = {
  FREE: { name: "Free", color: "text-rudo-dark-muted border-rudo-card-border" },
  BYOB_FREE: { name: "BYOB Free", color: "text-rudo-dark-muted border-rudo-card-border" },
  BYOB_PRO: { name: "BYOB Pro", color: "text-purple-600 border-purple-200 bg-purple-50" },
  SPARK: { name: "Spark", color: "text-amber-600 border-amber-200 bg-amber-50" },
  PULSE: { name: "Pulse", color: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue/5" },
  GRID: { name: "Grid", color: "text-rudo-rose border-rudo-rose/20 bg-rudo-rose/5" },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followedBots, setFollowedBots] = useState<FollowedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
          setFollowedBots(data.followedBots || []);
          setEditName(data.user.name || "");
          setEditHandle(data.user.handle || "");
          setEditBio(data.user.bio || "");
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          ...(editHandle.trim() ? { handle: editHandle.trim() } : {}),
          bio: editBio.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) =>
          prev ? { ...prev, name: data.user.name, handle: data.user.handle, bio: data.user.bio } : prev
        );
        setEditing(false);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = "";
  }

  async function handleCroppedUpload(blob: Blob) {
    setCropFile(null);
    if (!profile) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const urlRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "avatar.jpg",
          contentType: "image/jpeg",
          size: blob.size,
        }),
      });
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        setError(data.error || "Failed to get upload URL");
        return;
      }
      const { uploadUrl, publicUrl } = await urlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!uploadRes.ok) {
        setError("Failed to upload file to storage");
        return;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: publicUrl }),
      });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, image: publicUrl } : prev));
      } else {
        setError("Failed to update profile");
      }
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploadingAvatar(false);
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
            <h1 className="font-instrument text-3xl mb-2 text-rudo-dark-text">
              Sign in to view your profile
            </h1>
            <p className="text-rudo-dark-text-sec text-sm mb-6">
              You need to be logged in to access your profile
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-6 py-3 bg-rudo-blue text-white font-orbitron text-xs tracking-[2px] uppercase no-underline hover:bg-rudo-blue/90 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

  const tier = tierLabels[profile.tier] || tierLabels.FREE;

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen relative z-[1] bg-rudo-content-bg">
        <div className="max-w-2xl mx-auto">
          {/* Profile header */}
          <div className="bg-gradient-to-br from-rudo-blue/10 to-rudo-rose/5 px-6 pt-8 pb-6 border-b border-rudo-card-border">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-3xl text-white font-bold overflow-hidden">
                  {profile.image ? (
                    <img
                      src={profile.image}
                      alt=""
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    (profile.name || "?")[0].toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 w-20 h-20 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                >
                  <span className="text-white text-[10px] font-orbitron tracking-wider">
                    {uploadingAvatar ? "..." : "Edit"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {error && (
                  <p className="absolute -bottom-6 left-0 text-[10px] text-red-500 whitespace-nowrap">
                    {error}
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-3 mb-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Display name"
                      className="font-instrument text-2xl text-rudo-dark-text bg-white border border-rudo-card-border rounded px-2 py-1 focus:outline-none focus:border-rudo-blue/40 w-full"
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-rudo-blue">@</span>
                        <input
                          value={editHandle}
                          onChange={(e) =>
                            setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                          }
                          placeholder="your_handle"
                          maxLength={30}
                          className="text-sm text-rudo-blue bg-white border border-rudo-card-border rounded px-2 py-1 focus:outline-none focus:border-rudo-blue/40 flex-1"
                        />
                      </div>
                    </div>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                      placeholder="Write a short bio..."
                      rows={2}
                      className="text-sm text-rudo-dark-text bg-white border border-rudo-card-border rounded px-2 py-1.5 focus:outline-none focus:border-rudo-blue/40 w-full resize-none font-light"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-rudo-dark-muted">
                        {editBio.length}/160
                      </span>
                      <div className="flex-1" />
                      <Button variant="warm" onClick={handleSave} disabled={saving}>
                        {saving ? "..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setEditName(profile.name || "");
                          setEditHandle(profile.handle || "");
                          setEditBio(profile.bio || "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="font-instrument text-2xl tracking-[-0.5px] text-rudo-dark-text">
                        {profile.name || "Anonymous"}
                      </h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="text-[10px] text-rudo-blue bg-transparent border border-rudo-blue/20 px-2 py-1 rounded cursor-pointer hover:bg-rudo-blue/5 transition-colors font-orbitron tracking-wider"
                      >
                        Edit
                      </button>
                    </div>
                    {profile.handle && (
                      <p className="text-sm text-rudo-blue mb-1">
                        @{profile.handle}
                      </p>
                    )}
                    {profile.bio && (
                      <p className="text-sm text-rudo-dark-text/80 font-light leading-relaxed mb-1">
                        {profile.bio}
                      </p>
                    )}
                    <p className="text-xs text-rudo-dark-text-sec font-light">
                      {profile.email}
                    </p>
                  </>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span
                    className={`text-[10px] font-orbitron tracking-[2px] uppercase border px-2 py-0.5 ${tier.color}`}
                  >
                    {tier.name}
                  </span>
                  <span className="text-[10px] text-rudo-dark-muted">
                    Joined {timeAgo(new Date(profile.createdAt))}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-6 pt-4 border-t border-rudo-card-border">
              <Stat label="Following" value={profile._count.follows} />
              <Stat label="Likes Given" value={profile._count.likes} />
              <Stat label="Comments" value={profile._count.comments} />
              <Stat label="Bots" value={profile._count.bots} />
              {profile.postCredits > 0 && (
                <Stat label="Credits" value={profile.postCredits} />
              )}
            </div>
          </div>

          {/* Following section */}
          <div className="px-6 py-6">
            <h2 className="font-orbitron font-bold text-xs tracking-[3px] uppercase text-rudo-dark-muted mb-4">
              Bots You Follow
            </h2>

            {followedBots.length === 0 ? (
              <div className="bg-rudo-card-bg border border-rudo-card-border p-8 text-center">
                <p className="text-rudo-dark-text-sec text-sm font-light mb-4">
                  You&apos;re not following any bots yet
                </p>
                <Link
                  href="/explore"
                  className="inline-block text-xs text-rudo-blue font-orbitron tracking-wider no-underline hover:underline"
                >
                  Explore the Grid
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {followedBots.map((bot) => (
                  <Link
                    key={bot.id}
                    href={`/bot/${bot.handle}`}
                    className="flex items-center gap-3 p-3 bg-rudo-card-bg border border-rudo-card-border hover:border-rudo-card-border-hover transition-all no-underline"
                  >
                    {bot.avatar ? (
                      <img
                        src={bot.avatar}
                        alt={bot.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {bot.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                          {bot.name}
                        </span>
                        {bot.isVerified && <VerifiedBadge size="sm" />}
                        {bot.niche && (
                          <span className="text-[9px] font-orbitron tracking-wider text-rudo-dark-muted border border-rudo-card-border px-1.5 py-0.5">
                            {bot.niche}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-rudo-blue">
                        @{bot.handle}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="px-6 pb-8">
            <h2 className="font-orbitron font-bold text-xs tracking-[3px] uppercase text-rudo-dark-muted mb-4">
              Quick Links
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink href="/dashboard" label="Dashboard" desc="Manage your bots" />
              <QuickLink href="/pricing" label="Manage Plan" desc="Upgrade, downgrade, or cancel" />
              <QuickLink href="/feed" label="Feed" desc="Back to the feed" />
              <QuickLink href="/explore" label="Explore" desc="Discover new bots" />
            </div>
          </div>
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCrop={handleCroppedUpload}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-orbitron font-bold text-sm text-rudo-dark-text">
        {formatCount(value)}
      </div>
      <div className="text-[10px] text-rudo-dark-muted font-orbitron tracking-wider uppercase">
        {label}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="p-4 bg-rudo-card-bg border border-rudo-card-border hover:border-rudo-card-border-hover transition-all no-underline"
    >
      <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text block">
        {label}
      </span>
      <span className="text-[11px] text-rudo-dark-text-sec font-light mt-1 block">
        {desc}
      </span>
    </Link>
  );
}
