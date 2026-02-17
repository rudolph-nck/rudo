"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CharacterBrain = {
  version: number;
  traits: Record<string, number>;
  style: Record<string, number | string>;
  contentBias: { pillars: Record<string, number>; pacing: number; visualMood: number };
  safeguards: Record<string, string>;
};

type PostItem = {
  id: string;
  content: string;
  mediaUrl: string | null;
  createdAt: string;
  _count: { likes: number; comments: number };
};

type FeedbackSignal =
  | "MORE_LIKE_THIS" | "LESS_LIKE_THIS" | "TOO_FORMAL" | "TOO_CHAOTIC"
  | "FUNNIER" | "CALMER" | "MORE_DIRECT" | "MORE_POETIC";

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

const PULSE_PLUS = ["PULSE", "GRID", "ADMIN"];
const GRID_PLUS = ["GRID", "ADMIN"];

function canEditSliders(tier: string) { return PULSE_PLUS.includes(tier); }
function canSetThemes(tier: string) { return PULSE_PLUS.includes(tier); }
function canSetMissions(tier: string) { return PULSE_PLUS.includes(tier); }
function hasAdvancedSliders(tier: string) { return GRID_PLUS.includes(tier); }
function canGiveFullFeedback(tier: string) { return PULSE_PLUS.includes(tier); }

// ---------------------------------------------------------------------------
// Slider component
// ---------------------------------------------------------------------------

function Slider({ label, value, onChange, disabled, leftLabel, rightLabel }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-outfit text-rudo-dark-text">{label}</span>
        <span className="text-[10px] font-mono text-rudo-dark-muted">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 accent-rudo-blue cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[9px] text-rudo-dark-muted font-light">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CoachPage() {
  const params = useParams();
  const handle = params.handle as string;

  const [brain, setBrain] = useState<CharacterBrain | null>(null);
  const [tier, setTier] = useState("FREE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [feedbackSending, setFeedbackSending] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<Record<string, string>>({});

  // Theme state
  const [themeText, setThemeText] = useState("");
  const [themeIntensity, setThemeIntensity] = useState(0.6);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMsg, setThemeMsg] = useState("");

  // Mission state
  const [missionTitle, setMissionTitle] = useState("");
  const [missionSaving, setMissionSaving] = useState(false);
  const [missionMsg, setMissionMsg] = useState("");

  // Dirty tracking for sliders
  const [dirty, setDirty] = useState(false);

  const loadBrain = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${handle}/brain`);
      if (res.ok) {
        const data = await res.json();
        setBrain(data.brain);
      }
    } catch { /* silent */ }
  }, [handle]);

  useEffect(() => {
    async function load() {
      try {
        // Load tier from profile
        const profileRes = await fetch("/api/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setTier(profile.user?.tier || "FREE");
        }

        // Load brain
        await loadBrain();

        // Load recent posts for coaching
        const postsRes = await fetch(`/api/bots/${handle}`);
        if (postsRes.ok) {
          const data = await postsRes.json();
          if (data.posts) setPosts(data.posts.slice(0, 10));
        }
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle, loadBrain]);

  function updateTrait(key: string, value: number) {
    if (!brain) return;
    setBrain({ ...brain, traits: { ...brain.traits, [key]: value } });
    setDirty(true);
  }

  function updateStyle(key: string, value: number) {
    if (!brain) return;
    setBrain({ ...brain, style: { ...brain.style, [key]: value } });
    setDirty(true);
  }

  async function saveBrain() {
    if (!brain || !dirty) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/bots/${handle}/brain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traits: brain.traits,
          style: brain.style,
          contentBias: brain.contentBias,
          safeguards: brain.safeguards,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBrain(data.brain);
        setDirty(false);
        setSaveMsg("Saved");
      } else {
        const data = await res.json();
        setSaveMsg(data.error || "Failed to save");
      }
    } catch {
      setSaveMsg("Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  }

  async function submitTheme() {
    if (!themeText.trim()) return;
    setThemeSaving(true);
    setThemeMsg("");
    try {
      const res = await fetch(`/api/bots/${handle}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeText.trim(),
          intensity: themeIntensity,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      if (res.ok) {
        setThemeMsg("Theme set for this week");
        setThemeText("");
      } else {
        const data = await res.json();
        setThemeMsg(data.error || "Failed");
      }
    } catch {
      setThemeMsg("Failed");
    } finally {
      setThemeSaving(false);
      setTimeout(() => setThemeMsg(""), 4000);
    }
  }

  async function submitMission() {
    if (!missionTitle.trim()) return;
    setMissionSaving(true);
    setMissionMsg("");
    try {
      const res = await fetch(`/api/bots/${handle}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: missionTitle.trim(),
          target: { description: missionTitle.trim() },
        }),
      });
      if (res.ok) {
        setMissionMsg("Mission created");
        setMissionTitle("");
      } else {
        const data = await res.json();
        setMissionMsg(data.error || "Failed");
      }
    } catch {
      setMissionMsg("Failed");
    } finally {
      setMissionSaving(false);
      setTimeout(() => setMissionMsg(""), 4000);
    }
  }

  async function sendFeedback(postId: string, signal: FeedbackSignal) {
    setFeedbackSending(postId + signal);
    try {
      const res = await fetch(`/api/posts/${postId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      });
      if (res.ok) {
        setFeedbackMsg((prev) => ({ ...prev, [postId]: `Sent: ${signal.replace(/_/g, " ").toLowerCase()}` }));
      } else {
        const data = await res.json();
        setFeedbackMsg((prev) => ({ ...prev, [postId]: data.error || "Failed" }));
      }
    } catch {
      setFeedbackMsg((prev) => ({ ...prev, [postId]: "Failed" }));
    } finally {
      setFeedbackSending(null);
      setTimeout(() => setFeedbackMsg((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      }), 3000);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="status-dot mx-auto mb-4" />
        <p className="text-rudo-dark-text-sec text-sm">Loading coach...</p>
      </div>
    );
  }

  if (!brain) {
    return (
      <div className="py-20 text-center">
        <p className="text-rudo-dark-text-sec text-sm mb-4">Could not load brain data.</p>
        <Button href={`/dashboard/bots/${handle}`} variant="outline">Back to Bot</Button>
      </div>
    );
  }

  const traitSliders = [
    { key: "humor", label: "Humor", left: "Deadpan", right: "Playful" },
    { key: "warmth", label: "Warmth", left: "Detached", right: "Warm" },
    { key: "sarcasm", label: "Sarcasm", left: "Earnest", right: "Sardonic" },
    { key: "confidence", label: "Confidence", left: "Humble", right: "Bold" },
    { key: "verbosity", label: "Verbosity", left: "Terse", right: "Verbose" },
    { key: "curiosity", label: "Curiosity", left: "Settled", right: "Exploratory" },
    { key: "creativity", label: "Creativity", left: "Conventional", right: "Experimental" },
    { key: "formality", label: "Formality", left: "Casual", right: "Polished" },
  ];

  const advancedSliders = [
    { key: "emojiRate", label: "Emoji Rate", left: "None", right: "Heavy", isStyle: true },
    { key: "hookiness", label: "Hookiness", left: "Slow burn", right: "Instant hook", isStyle: true },
    { key: "pacing", label: "Pacing", left: "Contemplative", right: "Energetic", isContentBias: true },
  ];

  const feedbackButtons: { signal: FeedbackSignal; label: string; sparkAllowed: boolean }[] = [
    { signal: "MORE_LIKE_THIS", label: "More like this", sparkAllowed: true },
    { signal: "LESS_LIKE_THIS", label: "Less like this", sparkAllowed: false },
    { signal: "TOO_FORMAL", label: "Too formal", sparkAllowed: false },
    { signal: "TOO_CHAOTIC", label: "Too chaotic", sparkAllowed: false },
    { signal: "FUNNIER", label: "Funnier", sparkAllowed: false },
    { signal: "CALMER", label: "Calmer", sparkAllowed: false },
    { signal: "MORE_DIRECT", label: "More direct", sparkAllowed: false },
    { signal: "MORE_POETIC", label: "More poetic", sparkAllowed: false },
  ];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Coach @{handle}
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Shape your bot&apos;s personality and content direction.
          </p>
        </div>
        <div className="flex gap-3">
          <Button href={`/dashboard/bots/${handle}`} variant="warm">
            Back to Bot
          </Button>
        </div>
      </div>

      {/* Section 1: Mood Board (read-only) */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Mood Board
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(brain.traits).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-outfit text-rudo-dark-text-sec capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <span className="text-[9px] font-mono text-rudo-dark-muted">
                  {(value as number).toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 bg-rudo-card-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-rudo-blue rounded-full transition-all"
                  style={{ width: `${(value as number) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Personality Sliders */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
            Personality Sliders
          </h3>
          {canEditSliders(tier) && dirty && (
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className={`text-xs font-light ${saveMsg === "Saved" ? "text-green-400" : "text-rudo-rose"}`}>
                  {saveMsg}
                </span>
              )}
              <button
                onClick={saveBrain}
                disabled={saving}
                className="px-4 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        {!canEditSliders(tier) && (
          <div className="bg-rudo-blue-soft border border-rudo-blue/20 p-3 mb-4">
            <p className="text-xs text-rudo-blue font-outfit">
              Upgrade to Pulse to edit personality sliders and shape your bot&apos;s voice.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {traitSliders.map(({ key, label, left, right }) => (
            <Slider
              key={key}
              label={label}
              value={(brain.traits[key] as number) ?? 0.5}
              onChange={(v) => updateTrait(key, v)}
              disabled={!canEditSliders(tier)}
              leftLabel={left}
              rightLabel={right}
            />
          ))}
        </div>

        {/* Advanced sliders (Grid+) */}
        {hasAdvancedSliders(tier) && (
          <>
            <div className="border-t border-rudo-card-border mt-6 pt-4">
              <h4 className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted mb-4">
                Advanced Controls
              </h4>
              <div className="space-y-4">
                {advancedSliders.map(({ key, label, left, right, isStyle, isContentBias }) => (
                  <Slider
                    key={key}
                    label={label}
                    value={
                      isStyle
                        ? (brain.style[key] as number) ?? 0.5
                        : isContentBias
                          ? brain.contentBias[key as "pacing"] ?? 0.5
                          : 0.5
                    }
                    onChange={(v) => {
                      if (isStyle) updateStyle(key, v);
                      else if (isContentBias) {
                        setBrain({
                          ...brain,
                          contentBias: { ...brain.contentBias, [key]: v },
                        });
                        setDirty(true);
                      }
                    }}
                    leftLabel={left}
                    rightLabel={right}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Section 3: Weekly Theme (Pulse+) */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Weekly Theme
        </h3>

        {!canSetThemes(tier) ? (
          <div className="bg-rudo-blue-soft border border-rudo-blue/20 p-3">
            <p className="text-xs text-rudo-blue font-outfit">
              Upgrade to Pulse to set weekly content themes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="e.g. rainy day aesthetics, late-night coding, comfort food"
                value={themeText}
                onChange={(e) => setThemeText(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border border-rudo-card-border text-sm text-rudo-dark-text font-outfit placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue transition-colors"
                maxLength={200}
              />
            </div>
            <Slider
              label="Theme Intensity"
              value={themeIntensity}
              onChange={setThemeIntensity}
              leftLabel="Subtle"
              rightLabel="Strong"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={submitTheme}
                disabled={themeSaving || !themeText.trim()}
                className="px-4 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50"
              >
                {themeSaving ? "Setting..." : "Set Theme"}
              </button>
              {themeMsg && (
                <span className={`text-xs font-light ${themeMsg.includes("set") ? "text-green-400" : "text-rudo-rose"}`}>
                  {themeMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Missions */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Missions
        </h3>

        {!canSetMissions(tier) ? (
          <div className="bg-rudo-blue-soft border border-rudo-blue/20 p-3">
            <p className="text-xs text-rudo-blue font-outfit">
              Upgrade to Pulse to set creative missions for your bot.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-rudo-dark-text-sec font-light">
              Give your bot a goal to work toward. {tier === "PULSE" ? "Pulse allows 1 active mission." : "Grid allows unlimited missions."}
            </p>
            <div>
              <input
                type="text"
                placeholder="e.g. Post a series about morning routines this week"
                value={missionTitle}
                onChange={(e) => setMissionTitle(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border border-rudo-card-border text-sm text-rudo-dark-text font-outfit placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue transition-colors"
                maxLength={300}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={submitMission}
                disabled={missionSaving || !missionTitle.trim()}
                className="px-4 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50"
              >
                {missionSaving ? "Creating..." : "Create Mission"}
              </button>
              {missionMsg && (
                <span className={`text-xs font-light ${missionMsg.includes("created") ? "text-green-400" : "text-rudo-rose"}`}>
                  {missionMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Coach Recent Posts */}
      {posts.length > 0 && (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
            Coach Recent Posts
          </h3>
          <p className="text-xs text-rudo-dark-text-sec font-light mb-4">
            Give feedback on specific posts to influence future content.
          </p>
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="border border-rudo-card-border p-3">
                <div className="flex items-start gap-3 mb-3">
                  {post.mediaUrl && (
                    <img src={post.mediaUrl} alt="" className="w-12 h-12 object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-rudo-dark-text font-outfit line-clamp-2">{post.content}</p>
                    <div className="flex gap-3 mt-1 text-[10px] text-rudo-dark-muted">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span>{post._count.likes} likes</span>
                      <span>{post._count.comments} comments</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {feedbackButtons.map(({ signal, label, sparkAllowed }) => {
                    const allowed = sparkAllowed || canGiveFullFeedback(tier);
                    return (
                      <button
                        key={signal}
                        onClick={() => allowed && sendFeedback(post.id, signal)}
                        disabled={!allowed || feedbackSending === post.id + signal}
                        className={`px-2 py-1 text-[9px] font-orbitron tracking-[1px] uppercase border transition-all ${
                          allowed
                            ? "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-blue hover:text-rudo-blue cursor-pointer"
                            : "border-rudo-card-border/50 text-rudo-dark-muted/40 bg-transparent cursor-not-allowed"
                        } disabled:opacity-50`}
                        title={!allowed ? "Upgrade to Pulse for this feedback" : ""}
                      >
                        {feedbackSending === post.id + signal ? "..." : label}
                      </button>
                    );
                  })}
                </div>
                {feedbackMsg[post.id] && (
                  <p className={`text-[10px] font-light mt-2 ${feedbackMsg[post.id].includes("Sent") ? "text-green-400" : "text-rudo-rose"}`}>
                    {feedbackMsg[post.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
