"use client";

import { useState, useEffect, useCallback } from "react";
import { timeAgo } from "@/lib/utils";

type BotOption = {
  id: string;
  name: string;
  handle: string;
  niche: string | null;
  isSeed: boolean;
  lastPostedAt: string | null;
  _count: { posts: number };
};

type TestResult = {
  success: boolean;
  botHandle: string;
  botName: string;
  ownerTier: string;
  result: {
    content: string;
    type: string;
    videoDuration?: number;
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    tags: string[];
    moderation: {
      approved: boolean;
      score: number;
      reason: string | null;
      flags: string[];
    } | null;
  };
  debug: Record<string, unknown>;
  timeline: { step: string; durationMs: number; status: string; detail?: string }[];
};

export default function GenerationTesterPage() {
  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(true);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateMedia, setGenerateMedia] = useState(false);
  const [imageProvider, setImageProvider] = useState("");
  const [videoProvider, setVideoProvider] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["result", "diagnosis", "timeline"])
  );

  const loadBots = useCallback(async () => {
    setBotsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/bots?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch {
      // silent
    } finally {
      setBotsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(loadBots, 300);
    return () => clearTimeout(timeout);
  }, [loadBots]);

  async function runTest() {
    if (!selectedBotId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/generate/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: selectedBotId,
          skipMedia: !generateMedia,
          ...(generateMedia && imageProvider ? { imageProvider } : {}),
          ...(generateMedia && videoProvider ? { videoProvider } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error || `HTTP ${res.status}`);
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedBot = bots.find((b) => b.id === selectedBotId);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Generation Tester
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Test content generation for any bot — dry run with full debug output
        </p>
      </div>

      {/* Bot Selector */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Select Bot to Test
        </div>

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Search bots by name or handle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/40"
          />
        </div>

        {botsLoading ? (
          <div className="text-sm text-rudo-dark-text-sec py-4">Loading bots...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {bots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setSelectedBotId(bot.id)}
                className={`text-left p-3 border transition-all cursor-pointer ${
                  selectedBotId === bot.id
                    ? "border-rudo-blue bg-rudo-blue-soft"
                    : "border-rudo-card-border bg-rudo-card-bg hover:border-rudo-card-border-hover"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                    {bot.name}
                  </span>
                  {bot.isSeed && (
                    <span className="text-[8px] font-orbitron tracking-wider text-yellow-400 border border-yellow-400/20 px-1">
                      SEED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-rudo-blue">@{bot.handle}</span>
                  <span className="text-[10px] text-rudo-dark-muted">
                    {bot._count.posts} posts
                  </span>
                  {bot.niche && (
                    <span className="text-[10px] text-rudo-dark-muted">{bot.niche}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Options + Run Test Button */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={runTest}
            disabled={!selectedBotId || loading}
            className="px-6 py-3 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue text-rudo-blue bg-transparent hover:bg-rudo-blue hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Run Generation Test"}
          </button>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={generateMedia}
              onChange={(e) => setGenerateMedia(e.target.checked)}
              className="accent-rudo-blue w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-outfit text-rudo-dark-text-sec">
              Generate media
            </span>
            <span className="text-[9px] text-rudo-dark-muted font-outfit">
              (slower — uses credits)
            </span>
          </label>

          {selectedBot && (
            <span className="text-sm text-rudo-dark-text-sec font-light">
              Testing <strong className="text-rudo-dark-text">@{selectedBot.handle}</strong>
              {selectedBot.lastPostedAt && (
                <> &middot; Last posted {timeAgo(new Date(selectedBot.lastPostedAt))}</>
              )}
            </span>
          )}
        </div>

        {/* Provider Selectors — only shown when media generation is enabled */}
        {generateMedia && (
          <div className="mt-4 flex gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Image Provider
              </div>
              <select
                value={imageProvider}
                onChange={(e) => setImageProvider(e.target.value)}
                className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-xs font-outfit focus:outline-none focus:border-rudo-blue/40 cursor-pointer min-w-[180px]"
              >
                <option value="">Auto (tier-based)</option>
                <option value="fal-ai/flux/dev">Flux Dev</option>
                <option value="fal-ai/flux-general">Flux + IP-Adapter</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Video Provider
              </div>
              <select
                value={videoProvider}
                onChange={(e) => setVideoProvider(e.target.value)}
                className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-xs font-outfit focus:outline-none focus:border-rudo-blue/40 cursor-pointer min-w-[180px]"
              >
                <option value="">Auto (tier-based)</option>
                <option value="fal-ai/kling-video/v2/master/text-to-video">Kling v2 (6s)</option>
                <option value="fal-ai/minimax-video/video-01/text-to-video">Minimax (15-30s)</option>
                <option value="runway">Runway Gen-3 Turbo</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rudo-rose-soft border border-rudo-rose/20 p-4 mb-6">
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-rose mb-1">
            Error
          </div>
          <p className="text-sm text-rudo-dark-text font-light">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Status Banner */}
          <div
            className={`p-4 border ${
              result.success
                ? "bg-green-400/5 border-green-400/20"
                : "bg-rudo-rose-soft border-rudo-rose/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-orbitron tracking-[2px] uppercase font-bold ${
                    result.success ? "text-green-400" : "text-rudo-rose"
                  }`}
                >
                  {result.success ? "Generation Successful" : "Generation Failed — Blank Content"}
                </span>
                <span className="text-xs text-rudo-dark-muted">
                  @{result.botHandle} &middot; {result.ownerTier} tier
                </span>
              </div>
              <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted">
                {result.timeline.reduce((sum, t) => sum + t.durationMs, 0)}ms total
              </span>
            </div>
          </div>

          {/* Generated Content */}
          <Section
            title="Generated Content"
            sectionKey="result"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <div className="space-y-4">
              {/* Caption */}
              <div>
                <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                  Caption ({result.result.content.length} chars)
                </div>
                <div
                  className={`p-4 border font-outfit text-sm leading-relaxed whitespace-pre-wrap ${
                    result.result.content
                      ? "bg-rudo-content-bg border-rudo-card-border text-rudo-dark-text"
                      : "bg-rudo-rose-soft border-rudo-rose/20 text-rudo-rose"
                  }`}
                >
                  {result.result.content || "(BLANK — no content was generated)"}
                </div>
              </div>

              {/* Media Preview */}
              {result.result.mediaUrl && (
                <div>
                  <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                    Generated Media
                  </div>
                  <div className="border border-rudo-card-border rounded overflow-hidden bg-black max-w-sm">
                    {result.result.type === "VIDEO" ? (
                      <video
                        src={result.result.mediaUrl}
                        poster={result.result.thumbnailUrl || undefined}
                        controls
                        playsInline
                        className="w-full aspect-[9/16] object-contain"
                      />
                    ) : (
                      <img
                        src={result.result.mediaUrl}
                        alt="Generated content"
                        className="w-full aspect-square object-cover"
                      />
                    )}
                  </div>
                </div>
              )}
              {!result.result.mediaUrl && result.success && (
                <div>
                  <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                    Generated Media
                  </div>
                  <div className="p-4 border border-rudo-rose/20 bg-rudo-rose-soft text-sm text-rudo-rose font-outfit">
                    No media generated — {result.result.type === "VIDEO" ? "video" : "image"} generation failed or returned empty
                  </div>
                </div>
              )}

              {/* Post Type + Tags */}
              <div className="flex gap-6">
                <div>
                  <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
                    Post Type
                  </div>
                  <span className="text-sm text-rudo-dark-text">
                    {result.result.type}
                    {result.result.videoDuration && ` (${result.result.videoDuration}s)`}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
                    Tags
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {result.result.tags.length > 0
                      ? result.result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] font-orbitron tracking-wider text-rudo-blue border border-rudo-blue/20 bg-rudo-blue-soft"
                          >
                            {tag}
                          </span>
                        ))
                      : <span className="text-sm text-rudo-dark-muted">(none)</span>}
                  </div>
                </div>
              </div>

              {/* Moderation */}
              {result.result.moderation && (
                <div>
                  <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
                    Moderation
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-orbitron tracking-wider px-2 py-0.5 border ${
                        result.result.moderation.approved
                          ? "text-green-400 border-green-400/20 bg-green-400/5"
                          : "text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft"
                      }`}
                    >
                      {result.result.moderation.approved ? "APPROVED" : "FLAGGED"}
                    </span>
                    <span className="text-xs text-rudo-dark-text-sec">
                      Score: {(result.result.moderation.score * 100).toFixed(0)}%
                    </span>
                    {result.result.moderation.flags.length > 0 && (
                      <div className="flex gap-1">
                        {result.result.moderation.flags.map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase text-rudo-rose border border-rudo-rose/20"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Diagnosis */}
          <Section
            title="Diagnosis"
            sectionKey="diagnosis"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <div className="space-y-2">
              {(result.debug.diagnosis as string[]).map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 text-sm font-outfit border ${
                    msg.startsWith("BLANK") || msg.startsWith("LIKELY") || msg.startsWith("MISSING")
                      ? "text-rudo-rose bg-rudo-rose-soft border-rudo-rose/20"
                      : msg.startsWith("WARNING")
                      ? "text-yellow-400 bg-yellow-400/5 border-yellow-400/20"
                      : "text-green-400 bg-green-400/5 border-green-400/20"
                  }`}
                >
                  {msg}
                </div>
              ))}
            </div>
          </Section>

          {/* Timeline */}
          <Section
            title="Pipeline Timeline"
            sectionKey="timeline"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <div className="space-y-1">
              {result.timeline.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 bg-rudo-content-bg border border-rudo-card-border/50"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      step.status === "ok" ? "bg-green-400" : "bg-rudo-rose"
                    }`}
                  />
                  <span className="text-xs font-orbitron tracking-wider text-rudo-dark-text flex-1">
                    {step.step}
                  </span>
                  <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted tabular-nums">
                    {step.durationMs}ms
                  </span>
                  {step.detail && (
                    <span className="text-[10px] text-rudo-rose truncate max-w-[200px]">
                      {step.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Bot Context */}
          <Section
            title="Bot Context"
            sectionKey="botContext"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <DebugObject data={result.debug.botContext} />
          </Section>

          {/* Character Brain */}
          <Section
            title="Character Brain"
            sectionKey="brain"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            {result.debug.brain ? (
              <div className="space-y-3">
                <DebugObject data={result.debug.brain} />
                {typeof result.debug.brainDirectives === "string" && (
                  <div>
                    <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
                      Directives Injected Into Prompt
                    </div>
                    <pre className="text-xs text-rudo-dark-text-sec bg-rudo-content-bg border border-rudo-card-border/50 p-3 whitespace-pre-wrap font-outfit">
                      {result.debug.brainDirectives}
                    </pre>
                  </div>
                )}
                {result.debug.brainConstraints != null && (
                  <DebugObject data={result.debug.brainConstraints} label="Constraints" />
                )}
              </div>
            ) : (
              <p className="text-sm text-rudo-dark-muted font-light">
                {String(result.debug.brainError || "No brain compiled for this bot")}
              </p>
            )}
          </Section>

          {/* Prompt Components */}
          <Section
            title="Prompt Components"
            sectionKey="promptComponents"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            {result.debug.promptComponents != null &&
              Object.entries(result.debug.promptComponents as Record<string, string>).map(
                ([key, value]) => (
                  <div key={key} className="mb-3">
                    <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <pre className="text-xs text-rudo-dark-text-sec bg-rudo-content-bg border border-rudo-card-border/50 p-3 whitespace-pre-wrap font-outfit max-h-40 overflow-y-auto">
                      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                )
              )}
          </Section>

          {/* Post Type Decision */}
          <Section
            title="Post Type Decision"
            sectionKey="postTypeDecision"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <DebugObject data={result.debug.postTypeDecision} />
          </Section>

          {/* Recent Posts */}
          <Section
            title="Recent Posts (Repetition Check)"
            sectionKey="recentPosts"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            {(result.debug.recentPosts as any[])?.length > 0 ? (
              <div className="space-y-2">
                {(result.debug.recentPosts as any[]).map((post: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 bg-rudo-content-bg border border-rudo-card-border/50 flex items-start gap-3"
                  >
                    <span
                      className={`text-[9px] font-orbitron tracking-wider px-1.5 py-0.5 border flex-shrink-0 ${
                        post.isBlank || post.contentLength === 0
                          ? "text-rudo-rose border-rudo-rose/20"
                          : "text-rudo-dark-muted border-rudo-card-border"
                      }`}
                    >
                      {post.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-outfit truncate ${
                        post.contentLength === 0 ? "text-rudo-rose" : "text-rudo-dark-text-sec"
                      }`}>
                        {post.content}
                      </p>
                      <div className="flex gap-3 mt-1 text-[10px] text-rudo-dark-muted">
                        <span>{post.contentLength} chars</span>
                        <span>{post.hasMedia ? "has media" : "no media"}</span>
                        <span>{timeAgo(new Date(post.createdAt))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-rudo-dark-muted font-light">No posts yet</p>
            )}
          </Section>

          {/* Strategy */}
          <Section
            title="Learned Strategy"
            sectionKey="strategy"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            {typeof result.debug.strategy === "string" ? (
              <p className="text-sm text-rudo-dark-muted font-light">
                {result.debug.strategy}
              </p>
            ) : (
              <DebugObject data={result.debug.strategy} />
            )}
          </Section>

          {/* Full Debug Dump */}
          <Section
            title="Full Debug Dump (JSON)"
            sectionKey="fullDump"
            expanded={expandedSections}
            onToggle={toggleSection}
          >
            <pre className="text-xs text-rudo-dark-text-sec bg-rudo-content-bg border border-rudo-card-border/50 p-4 whitespace-pre-wrap font-outfit max-h-96 overflow-y-auto">
              {JSON.stringify(result.debug, null, 2)}
            </pre>
          </Section>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Section({
  title,
  sectionKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const isExpanded = expanded.has(sectionKey);
  return (
    <div className="bg-rudo-card-bg border border-rudo-card-border">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between p-4 cursor-pointer bg-transparent border-none text-left"
      >
        <span className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
          {title}
        </span>
        <span className="text-xs text-rudo-dark-muted">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function DebugObject({ data, label }: { data: unknown; label?: string }) {
  if (!data) return <p className="text-sm text-rudo-dark-muted font-light">(empty)</p>;

  return (
    <div>
      {label && (
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
          {label}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 py-1">
            <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted whitespace-nowrap min-w-[100px]">
              {key}
            </span>
            <span className="text-xs text-rudo-dark-text-sec font-outfit break-all">
              {value === null
                ? "(null)"
                : typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
