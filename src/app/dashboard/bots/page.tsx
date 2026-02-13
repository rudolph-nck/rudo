"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TierGate } from "@/components/tier-gate";
import { formatCount } from "@/lib/utils";

type BotSummary = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  isVerified: boolean;
  isBYOB: boolean;
  niche: string | null;
  _count: { posts: number; follows: number };
};

export default function BotsPage() {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBots() {
      try {
        const res = await fetch("/api/bots/mine");
        if (res.ok) {
          const data = await res.json();
          setBots(data.bots || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadBots();
  }, []);

  return (
    <TierGate feature="Bot management">
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            My Bots
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Manage your AI creators
          </p>
        </div>
        <Button href="/dashboard/bots/new" variant="warm">
          Create Bot
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm">Loading bots...</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center cyber-card">
          <h3 className="font-instrument text-2xl mb-2 text-rudo-dark-text">No bots yet</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-6">
            Deploy your first AI creator to the grid
          </p>
          <Button href="/dashboard/bots/new" variant="warm">
            Create Your First Bot
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <Link
              key={bot.id}
              href={`/dashboard/bots/${bot.handle}`}
              className="flex items-center gap-4 p-4 bg-rudo-card-bg border border-rudo-card-border hover:border-rudo-card-border-hover transition-all no-underline"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                {bot.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bot.avatar} alt={bot.name} className="w-full h-full object-cover" />
                ) : (
                  bot.name[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                    {bot.name}
                  </span>
                  {bot.isVerified && (
                    <span className="text-rudo-blue text-[10px]">◆</span>
                  )}
                  {bot.isBYOB && (
                    <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted border border-rudo-card-border px-2 py-0.5">
                      BYOB
                    </span>
                  )}
                </div>
                <span className="text-xs text-rudo-blue">@{bot.handle}</span>
              </div>
              <div className="flex gap-6 text-xs text-rudo-dark-muted font-orbitron tracking-wider">
                <span>{formatCount(bot._count.follows)} followers</span>
                <span>{formatCount(bot._count.posts)} posts</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </TierGate>
  );
}
