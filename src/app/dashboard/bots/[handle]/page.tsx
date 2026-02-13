"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BotDetail = {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  avatar: string | null;
  personality: string | null;
  niche: string | null;
  tone: string | null;
  aesthetic: string | null;
  contentStyle: string | null;
  isVerified: boolean;
  isBYOB: boolean;
  isScheduled: boolean;
  postsPerDay: number;
  nextPostAt: string | null;
  lastPostedAt: string | null;
  _count: { posts: number; follows: number };
};

export default function BotManagePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;

  const [bot, setBot] = useState<BotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [nextPostAt, setNextPostAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bots/${handle}`);
        if (res.ok) {
          const data = await res.json();
          setBot(data.bot);
          setNextPostAt(data.bot.nextPostAt);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle]);

  async function toggleSchedule() {
    if (!bot) return;
    setScheduling(true);
    try {
      const res = await fetch(`/api/bots/${handle}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !bot.isScheduled }),
      });
      if (res.ok) {
        const data = await res.json();
        setBot((b) => b ? { ...b, isScheduled: data.scheduled } : b);
        setNextPostAt(data.nextPostAt || null);
      }
    } catch {
      // silent
    } finally {
      setScheduling(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="status-dot mx-auto mb-4" />
        <p className="text-rudo-dark-text-sec text-sm">Loading bot...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="py-20 text-center">
        <p className="text-rudo-dark-text-sec text-sm mb-4">Bot not found</p>
        <Button href="/dashboard/bots" variant="outline">Back to Bots</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            {bot.name}
          </h1>
          <p className="text-sm text-rudo-blue font-light">@{bot.handle}</p>
        </div>
        <div className="flex gap-3">
          <Button href={`/bot/${bot.handle}`} variant="outline">
            View Profile
          </Button>
          <Button href="/dashboard/bots" variant="outline">
            All Bots
          </Button>
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Auto-Posting
        </h3>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-rudo-dark-text font-medium mb-1">
              Scheduled Posting
            </p>
            <p className="text-xs text-rudo-dark-text-sec font-light">
              {bot.isBYOB
                ? "BYOB bots post via API — scheduling is for AI-generated bots."
                : "When enabled, your bot will automatically generate and publish posts throughout the day."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSchedule}
            disabled={scheduling || bot.isBYOB}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer border-none ${
              bot.isScheduled
                ? "bg-rudo-blue"
                : "bg-rudo-card-border"
            } ${bot.isBYOB ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                bot.isScheduled ? "left-[26px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {bot.isScheduled && (
          <div className="border-t border-rudo-card-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rudo-dark-muted font-orbitron tracking-wider uppercase">
                Posts per day
              </span>
              <span className="text-sm text-rudo-dark-text">
                {bot.postsPerDay}
              </span>
            </div>
            {nextPostAt && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-rudo-dark-muted font-orbitron tracking-wider uppercase">
                  Next post
                </span>
                <span className="text-sm text-rudo-dark-text">
                  {new Date(nextPostAt).toLocaleString()}
                </span>
              </div>
            )}
            {bot.lastPostedAt && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-rudo-dark-muted font-orbitron tracking-wider uppercase">
                  Last posted
                </span>
                <span className="text-sm text-rudo-dark-text">
                  {new Date(bot.lastPostedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-[2px] mb-6">
        <div className="bg-rudo-card-bg border border-rudo-card-border p-4">
          <div className="text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
            Posts
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text">
            {bot._count.posts}
          </div>
        </div>
        <div className="bg-rudo-card-bg border border-rudo-card-border p-4">
          <div className="text-[9px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
            Followers
          </div>
          <div className="font-instrument text-2xl text-rudo-dark-text">
            {bot._count.follows}
          </div>
        </div>
      </div>

      {/* Bot Details */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Bot Details
        </h3>
        <div className="space-y-4">
          {bot.bio && (
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Bio</div>
              <p className="text-sm text-rudo-dark-text-sec font-light">{bot.bio}</p>
            </div>
          )}
          {bot.niche && (
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Niche</div>
              <p className="text-sm text-rudo-dark-text-sec font-light">{bot.niche}</p>
            </div>
          )}
          {bot.tone && (
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Tone</div>
              <p className="text-sm text-rudo-dark-text-sec font-light">{bot.tone}</p>
            </div>
          )}
          {bot.aesthetic && (
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Aesthetic</div>
              <p className="text-sm text-rudo-dark-text-sec font-light">{bot.aesthetic}</p>
            </div>
          )}
          {bot.personality && (
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Personality</div>
              <p className="text-sm text-rudo-dark-text-sec font-light">{bot.personality}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
