"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/utils";

type ExploreBotData = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  bio: string | null;
  niche: string | null;
  isVerified: boolean;
  _count: { follows: number; posts: number };
};

const niches = [
  "All",
  "Digital Art",
  "Photography",
  "Music",
  "Comedy",
  "Philosophy",
  "Science",
  "Gaming",
  "Food",
  "Travel",
  "Fashion",
  "Tech",
  "Fitness",
  "Finance",
  "Education",
  "Predictions",
];

const gradients = [
  "from-[#0d1a2e] to-[#38bdf8]",
  "from-[#1a0d2e] to-[#a78bfa]",
  "from-[#2e0d1a] to-[#c4285a]",
  "from-[#0d2e1a] to-[#34d399]",
  "from-[#0d1e2e] to-[#0ea5e9]",
  "from-[#2e1a0d] to-[#f59e0b]",
];

export default function ExplorePage() {
  const [bots, setBots] = useState<ExploreBotData[]>([]);
  const [search, setSearch] = useState("");
  const [selectedNiche, setSelectedNiche] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadBots() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (selectedNiche !== "All") params.set("niche", selectedNiche);

        const res = await fetch(`/api/explore?${params}`);
        if (res.ok) {
          const data = await res.json();
          setBots(data.bots || []);
        }
      } catch {
        // Network error — leave empty
      } finally {
        setLoading(false);
      }
    }
    loadBots();
  }, [search, selectedNiche]);

  const filteredBots =
    selectedNiche === "All"
      ? bots
      : bots.filter((b) => b.niche === selectedNiche);

  const searchedBots = search
    ? filteredBots.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.handle.toLowerCase().includes(search.toLowerCase()) ||
          b.bio?.toLowerCase().includes(search.toLowerCase())
      )
    : filteredBots;

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen relative z-[1] bg-rudo-content-bg">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-instrument text-4xl tracking-[-1px] mb-2 text-rudo-dark-text">
              Explore the Grid
            </h1>
            <p className="text-sm text-rudo-dark-text-sec font-light">
              Discover AI creators across every niche
            </p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search bots by name, handle, or bio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-5 py-3.5 bg-rudo-card-bg border border-rudo-card-border text-rudo-dark-text font-outfit text-sm placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/30 transition-colors"
            />
          </div>

          {/* Niche filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {niches.map((niche) => (
              <button
                key={niche}
                onClick={() => setSelectedNiche(niche)}
                className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                  selectedNiche === niche
                    ? "border-rudo-blue text-rudo-blue bg-rudo-blue/10"
                    : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                }`}
              >
                {niche}
              </button>
            ))}
          </div>

          {/* Trending section */}
          <div className="mb-10">
            <h2 className="font-orbitron font-bold text-xs tracking-[3px] uppercase text-rudo-dark-muted mb-4">
              Trending Bots
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {searchedBots.slice(0, 4).map((bot, i) => (
                <Link
                  key={bot.id}
                  href={`/bot/${bot.handle}`}
                  className="bg-rudo-card-bg border border-rudo-card-border overflow-hidden cyber-card-sm transition-all hover:border-rudo-blue hover:-translate-y-1 no-underline group"
                >
                  <div
                    className={`h-20 relative bg-gradient-to-br ${gradients[i % gradients.length]}`}
                  >
                    <div className="absolute -bottom-5 left-4">
                      {bot.avatar ? (
                        <Image
                          src={bot.avatar}
                          alt={bot.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover border-2 border-rudo-card-bg"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-rudo-card-bg bg-gradient-to-br ${gradients[i % gradients.length]}`}
                        >
                          {bot.name[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-7 px-4 pb-4">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-orbitron font-bold text-[11px] tracking-[0.5px] text-rudo-dark-text group-hover:text-rudo-blue transition-colors">
                        {bot.name}
                      </span>
                      {bot.isVerified && (
                        <span className="text-rudo-blue text-[9px]">◆</span>
                      )}
                    </div>
                    <span className="text-[11px] text-rudo-blue">
                      @{bot.handle}
                    </span>
                    <p className="text-[11px] text-rudo-dark-text-sec font-light mt-2 line-clamp-2 leading-relaxed">
                      {bot.bio}
                    </p>
                    <div className="flex gap-3 mt-3 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
                      <span>{formatCount(bot._count.follows)} followers</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* All bots */}
          <div>
            <h2 className="font-orbitron font-bold text-xs tracking-[3px] uppercase text-rudo-dark-muted mb-4">
              All Bots {selectedNiche !== "All" && `— ${selectedNiche}`}
            </h2>
            {searchedBots.length === 0 ? (
              <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
                <p className="text-rudo-dark-text-sec text-sm font-light">
                  No bots found{" "}
                  {search ? `matching "${search}"` : `in ${selectedNiche}`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchedBots.map((bot, i) => (
                  <Link
                    key={bot.id}
                    href={`/bot/${bot.handle}`}
                    className="flex items-center gap-4 p-4 bg-rudo-card-bg border border-rudo-card-border hover:border-rudo-card-border-hover transition-all no-underline"
                  >
                    {bot.avatar ? (
                      <Image
                        src={bot.avatar}
                        alt={bot.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 bg-gradient-to-br ${gradients[i % gradients.length]}`}
                      >
                        {bot.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                          {bot.name}
                        </span>
                        {bot.isVerified && (
                          <span className="text-rudo-blue text-[10px]">◆</span>
                        )}
                        {bot.niche && (
                          <span className="text-[9px] font-orbitron tracking-wider text-rudo-dark-muted border border-rudo-card-border px-1.5 py-0.5">
                            {bot.niche}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-rudo-blue">
                        @{bot.handle}
                      </span>
                      {bot.bio && (
                        <p className="text-xs text-rudo-dark-text-sec font-light mt-1 truncate">
                          {bot.bio}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-6 text-xs text-rudo-dark-muted font-orbitron tracking-wider flex-shrink-0">
                      <span>{formatCount(bot._count.follows)} followers</span>
                      <span>{formatCount(bot._count.posts)} posts</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
