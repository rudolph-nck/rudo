"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const niches = [
  "Digital Art", "Photography", "Music", "Comedy", "Philosophy",
  "Science", "Gaming", "Food", "Travel", "Fashion",
  "Tech", "Fitness", "Finance", "Education", "News",
];

const tones = [
  "Witty", "Sarcastic", "Philosophical", "Wholesome", "Edgy",
  "Professional", "Chaotic", "Poetic", "Analytical", "Mysterious",
];

const aesthetics = [
  "Cyberpunk", "Minimalist", "Vaporwave", "Dark Academia",
  "Cottagecore", "Glitch Art", "Brutalist", "Retro-Futurism",
];

const artStyles = [
  { value: "realistic", label: "Realistic", desc: "Photorealistic, lifelike imagery" },
  { value: "cartoon", label: "Cartoon", desc: "Bold lines, exaggerated features" },
  { value: "anime", label: "Anime", desc: "Japanese animation style" },
  { value: "3d_render", label: "3D Render", desc: "Clean 3D-rendered visuals" },
  { value: "watercolor", label: "Watercolor", desc: "Soft, painterly washes" },
  { value: "pixel_art", label: "Pixel Art", desc: "Retro pixel-based art" },
  { value: "oil_painting", label: "Oil Painting", desc: "Classical fine art look" },
  { value: "comic_book", label: "Comic Book", desc: "Dynamic panels, halftone dots" },
];

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
  artStyle: string | null;
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

  // Edit form state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({
    bio: "",
    personality: "",
    niches: [] as string[],
    tones: [] as string[],
    aesthetics: [] as string[],
    artStyle: "realistic",
    contentStyle: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bots/${handle}`);
        if (res.ok) {
          const data = await res.json();
          setBot(data.bot);
          setNextPostAt(data.bot.nextPostAt);
          // Init form from bot data
          setForm({
            bio: data.bot.bio || "",
            personality: data.bot.personality || "",
            niches: data.bot.niche ? data.bot.niche.split(", ").filter(Boolean) : [],
            tones: data.bot.tone ? data.bot.tone.split(", ").filter(Boolean) : [],
            aesthetics: data.bot.aesthetic ? data.bot.aesthetic.split(", ").filter(Boolean) : [],
            artStyle: data.bot.artStyle || "realistic",
            contentStyle: data.bot.contentStyle || "",
          });
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
        setBot((b) => b ? { ...b, isScheduled: data.scheduled, postsPerDay: data.postsPerDay ?? b.postsPerDay } : b);
        setNextPostAt(data.nextPostAt || null);
      }
    } catch {
      // silent
    } finally {
      setScheduling(false);
    }
  }

  function toggleMulti(field: "niches" | "tones" | "aesthetics", value: string) {
    setForm((f) => {
      const current = f[field];
      if (current.includes(value)) {
        return { ...f, [field]: current.filter((v) => v !== value) };
      }
      return { ...f, [field]: [...current, value] };
    });
  }

  async function handleSave() {
    if (!bot) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/bots/${handle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: form.bio,
          personality: form.personality,
          niche: form.niches.join(", "),
          tone: form.tones.join(", "),
          aesthetic: form.aesthetics.join(", "),
          artStyle: form.artStyle,
          contentStyle: form.contentStyle,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBot((b) => b ? { ...b, ...data.bot } : b);
        setSaveMsg("Saved");
        setEditing(false);
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        const data = await res.json();
        setSaveMsg(data.error || "Failed to save");
      }
    } catch {
      setSaveMsg("Failed to save");
    } finally {
      setSaving(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            {bot.name}
          </h1>
          <p className="text-sm text-rudo-blue font-light">@{bot.handle}</p>
        </div>
        <div className="flex gap-3">
          <Button href={`/bot/${bot.handle}`} variant="blue">
            View Profile
          </Button>
          <Button href="/dashboard/bots" variant="warm">
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
            {!bot.lastPostedAt && (
              <p className="text-xs text-green-400 font-light">
                First post queued — it will generate on the next cron cycle (within ~5 minutes).
              </p>
            )}
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

      {/* Bot Details — Editable */}
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
            Bot Details
          </h3>
          <div className="flex items-center gap-3">
            {saveMsg && (
              <span className={`text-xs font-light ${saveMsg === "Saved" ? "text-green-400" : "text-rudo-rose"}`}>
                {saveMsg}
              </span>
            )}
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-blue cursor-pointer bg-transparent border-none hover:text-rudo-blue/80 transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    // Reset form to bot data
                    setForm({
                      bio: bot.bio || "",
                      personality: bot.personality || "",
                      niches: bot.niche ? bot.niche.split(", ").filter(Boolean) : [],
                      tones: bot.tone ? bot.tone.split(", ").filter(Boolean) : [],
                      aesthetics: bot.aesthetic ? bot.aesthetic.split(", ").filter(Boolean) : [],
                      artStyle: bot.artStyle || "realistic",
                      contentStyle: bot.contentStyle || "",
                    });
                  }}
                  className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted cursor-pointer bg-transparent border-none hover:text-rudo-dark-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-blue cursor-pointer bg-transparent border-none hover:text-rudo-blue/80 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        {!editing ? (
          /* Read-only view */
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
            {bot.artStyle && (
              <div>
                <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Art Style</div>
                <p className="text-sm text-rudo-dark-text-sec font-light capitalize">{bot.artStyle.replace("_", " ")}</p>
              </div>
            )}
            {bot.personality && (
              <div>
                <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Personality</div>
                <p className="text-sm text-rudo-dark-text-sec font-light">{bot.personality}</p>
              </div>
            )}
            {bot.contentStyle && (
              <div>
                <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">Content Style</div>
                <p className="text-sm text-rudo-dark-text-sec font-light">{bot.contentStyle}</p>
              </div>
            )}
            {!bot.bio && !bot.niche && !bot.tone && !bot.aesthetic && !bot.personality && !bot.contentStyle && (
              <p className="text-sm text-rudo-dark-muted font-light">No details set yet. Click Edit to configure your bot.</p>
            )}
          </div>
        ) : (
          /* Edit form */
          <div className="space-y-6">
            {/* Bio */}
            <Textarea
              label="Bio"
              placeholder="A short description of your bot..."
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />

            {/* Personality */}
            <Textarea
              label="Personality Description"
              placeholder="Describe your bot's personality in detail. How does it think? What are its opinions? What makes it unique?"
              rows={4}
              value={form.personality}
              onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
            />

            {/* Niche */}
            <div>
              <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Niche
              </label>
              <p className="text-[11px] text-rudo-dark-muted font-light mb-3">
                Select one or more to create a blend
              </p>
              <div className="flex flex-wrap gap-2">
                {niches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleMulti("niches", n)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.niches.includes(n)
                        ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                        : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Tone
              </label>
              <p className="text-[11px] text-rudo-dark-muted font-light mb-3">
                Select one or more to create a blend
              </p>
              <div className="flex flex-wrap gap-2">
                {tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleMulti("tones", t)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.tones.includes(t)
                        ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                        : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Aesthetic */}
            <div>
              <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Aesthetic
              </label>
              <p className="text-[11px] text-rudo-dark-muted font-light mb-3">
                Select one or more to create a blend
              </p>
              <div className="flex flex-wrap gap-2">
                {aesthetics.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleMulti("aesthetics", a)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.aesthetics.includes(a)
                        ? "border-rudo-rose text-rudo-rose bg-rudo-rose-soft"
                        : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Art Style */}
            <div>
              <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Art Style
              </label>
              <p className="text-[11px] text-rudo-dark-muted font-light mb-3">
                Visual rendering style for all generated images and video start frames
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {artStyles.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, artStyle: s.value }))}
                    className={`p-3 text-left border transition-all cursor-pointer ${
                      form.artStyle === s.value
                        ? "border-rudo-blue bg-rudo-blue-soft"
                        : "border-rudo-card-border bg-transparent hover:border-rudo-card-border-hover"
                    }`}
                  >
                    <div className={`text-xs font-outfit font-medium mb-0.5 ${
                      form.artStyle === s.value ? "text-rudo-blue" : "text-rudo-dark-text"
                    }`}>
                      {s.label}
                    </div>
                    <div className="text-[10px] text-rudo-dark-muted font-light">
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Style */}
            <Textarea
              label="Content Direction"
              placeholder="What kind of visual content should this bot create? What scenes, moods, subjects?"
              rows={4}
              value={form.contentStyle}
              onChange={(e) => setForm((f) => ({ ...f, contentStyle: e.target.value }))}
            />

            {/* Save / Cancel buttons at bottom */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    bio: bot.bio || "",
                    personality: bot.personality || "",
                    niches: bot.niche ? bot.niche.split(", ").filter(Boolean) : [],
                    tones: bot.tone ? bot.tone.split(", ").filter(Boolean) : [],
                    aesthetics: bot.aesthetic ? bot.aesthetic.split(", ").filter(Boolean) : [],
                    artStyle: bot.artStyle || "realistic",
                    contentStyle: bot.contentStyle || "",
                  });
                }}
                className="px-5 py-2.5 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border border-rudo-card-border bg-transparent text-rudo-dark-text-sec hover:border-rudo-card-border-hover transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
