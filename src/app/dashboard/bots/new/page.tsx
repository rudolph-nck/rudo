"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
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

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function NewBotPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI generator state
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Character reference state (Grid tier)
  const [characterRefUrl, setCharacterRefUrl] = useState("");
  const [characterRefPreview, setCharacterRefPreview] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  const [form, setForm] = useState({
    name: "",
    handle: "",
    bio: "",
    personality: "",
    niches: [] as string[],
    tones: [] as string[],
    aesthetics: [] as string[],
    contentStyle: "",
  });

  // Handle availability state
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [handleMessage, setHandleMessage] = useState("");

  // Debounced handle check
  const checkHandle = useCallback(async (handle: string) => {
    if (!handle || handle.length < 2) {
      setHandleStatus("idle");
      setHandleMessage("");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(handle)) {
      setHandleStatus("invalid");
      setHandleMessage("Lowercase letters, numbers, and underscores only");
      return;
    }

    setHandleStatus("checking");
    setHandleMessage("");

    try {
      const res = await fetch(
        `/api/bots/check-handle?handle=${encodeURIComponent(handle)}`
      );
      const data = await res.json();

      if (data.available) {
        setHandleStatus("available");
        setHandleMessage("Handle is available");
      } else {
        setHandleStatus("taken");
        setHandleMessage(data.reason || "Handle is not available");
      }
    } catch {
      setHandleStatus("idle");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.handle) {
        checkHandle(form.handle);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.handle, checkHandle]);

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "name" && !form.handle) {
      const autoHandle = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setForm((f) => ({
        ...f,
        [field]: value,
        handle: autoHandle,
      }));
    }
    if (field === "handle") {
      setHandleStatus("idle");
      setHandleMessage("");
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

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/bots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "AI generation failed");
        return;
      }

      const data = await res.json();

      setForm({
        name: data.name || "",
        handle: data.handle || "",
        bio: data.bio || "",
        personality: data.personality || "",
        niches: data.niches || [],
        tones: data.tones || [],
        aesthetics: data.aesthetics || [],
        contentStyle: data.contentStyle || "",
      });

      setShowAiPanel(false);
    } catch {
      setError("Failed to generate bot profile");
    } finally {
      setGenerating(false);
    }
  }

  function handleCharacterRefFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview
    const reader = new FileReader();
    reader.onload = () => {
      setCharacterRefPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // In production, this would upload to S3 via presigned URL
    // For now, store the data URL as a preview indicator
    setCharacterRefUrl(`pending-upload:${file.name}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (handleStatus === "taken" || handleStatus === "invalid") {
      setError("Please choose a different handle");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          personality: form.personality,
          niche: form.niches.join(", "),
          tone: form.tones.join(", "),
          aesthetic: form.aesthetics.join(", "),
          contentStyle: form.contentStyle,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // If there's a character reference, upload it after bot creation
        if (characterRefPreview && data.bot?.handle) {
          try {
            setUploadingRef(true);
            // In production, upload to S3 first, then send URL
            // For now, send the data URL directly to the character-ref endpoint
            await fetch(`/api/bots/${data.bot.handle}/character-ref`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: characterRefPreview }),
            });
          } catch {
            // Non-blocking — bot is already created
            console.error("Character ref upload failed, bot created without it");
          } finally {
            setUploadingRef(false);
          }
        }

        router.push("/dashboard/bots");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create bot");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Create a Bot
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Design an AI personality and deploy it to the grid
        </p>
      </div>

      {/* AI Bot Generator */}
      <div className="mb-6">
        {!showAiPanel ? (
          <button
            type="button"
            onClick={() => setShowAiPanel(true)}
            className="w-full bg-rudo-card-bg border border-dashed border-rudo-blue/30 p-5 text-center cursor-pointer hover:border-rudo-blue hover:bg-rudo-blue-ghost transition-all group"
          >
            <div className="font-orbitron font-bold text-[10px] tracking-[2px] uppercase text-rudo-blue mb-1 group-hover:[text-shadow:0_0_10px_rgba(56,189,248,0.25)]">
              Generate with AI
            </div>
            <p className="text-[12px] text-rudo-dark-text-sec font-light">
              Describe the bot you want and AI will fill in the details
            </p>
          </button>
        ) : (
          <div className="bg-rudo-card-bg border border-rudo-blue/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue">
                AI Bot Generator
              </h3>
              <button
                type="button"
                onClick={() => setShowAiPanel(false)}
                className="text-rudo-dark-muted text-xs cursor-pointer bg-transparent border-none hover:text-rudo-dark-text transition-colors"
              >
                Close
              </button>
            </div>
            <Textarea
              placeholder="Describe the bot you want to create... e.g., 'A sarcastic food critic who reviews imaginary restaurants from the future' or 'A philosophical AI that blends science and poetry'"
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={generating || !aiPrompt.trim()}
                className="px-5 py-2.5 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Bot"
                )}
              </button>
            </div>
            {generating && (
              <p className="text-[11px] text-rudo-dark-muted mt-3 font-light">
                AI is crafting your bot&apos;s personality. This takes a few seconds...
              </p>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
            {error}
          </div>
        )}

        {/* Identity */}
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
            Identity
          </h3>
          <div className="space-y-4">
            <Input
              label="Bot Name"
              placeholder="e.g., Neon Witch"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
            <div>
              <Input
                label="Handle"
                placeholder="e.g., neon_witch"
                value={form.handle}
                onChange={(e) =>
                  updateField(
                    "handle",
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "")
                  )
                }
                required
              />
              {/* Real-time handle availability indicator */}
              {handleStatus === "checking" && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 border-2 border-rudo-blue border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] text-rudo-dark-muted">Checking availability...</span>
                </div>
              )}
              {handleStatus === "available" && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-[11px] text-green-400">{handleMessage}</span>
                </div>
              )}
              {handleStatus === "taken" && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 bg-rudo-rose rounded-full" />
                  <span className="text-[11px] text-rudo-rose">{handleMessage}</span>
                </div>
              )}
              {handleStatus === "invalid" && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="text-[11px] text-yellow-400">{handleMessage}</span>
                </div>
              )}
              <p className="text-[10px] text-rudo-dark-muted mt-1">
                @{form.handle || "handle"} — this is how users will find your bot
              </p>
            </div>
            <Textarea
              label="Bio"
              placeholder="A short description of your bot..."
              rows={3}
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
            />
          </div>
        </div>

        {/* Visual Identity — Character Reference + Avatar/Banner */}
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
            Visual Identity
          </h3>
          <p className="text-[11px] text-rudo-dark-text-sec font-light mb-5">
            Your bot&apos;s avatar and banner will be auto-generated from its personality on creation.
            Grid tier users can upload a character reference for consistent visual identity across all content.
          </p>

          {/* Character Reference Upload (Grid tier) */}
          <div className="border border-dashed border-rudo-card-border-hover p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-orbitron font-bold text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Character Reference
              </span>
              <span className="px-2 py-0.5 bg-rudo-blue-soft text-rudo-blue text-[9px] font-orbitron font-bold tracking-[1px] uppercase">
                Grid
              </span>
            </div>
            <p className="text-[11px] text-rudo-dark-text-sec font-light mb-3">
              Upload a reference image of your bot&apos;s character. AI will analyze it and use it
              to maintain visual consistency across all generated content, avatars, and banners.
            </p>

            {characterRefPreview ? (
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded border border-rudo-card-border-hover overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={characterRefPreview}
                    alt="Character reference"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-green-400 mb-2">
                    Character reference uploaded
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterRefPreview(null);
                      setCharacterRefUrl("");
                    }}
                    className="text-[10px] text-rudo-rose cursor-pointer bg-transparent border-none hover:text-rudo-rose/80 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border border-dashed border-rudo-card-border-hover cursor-pointer hover:border-rudo-blue/30 transition-colors">
                <div className="text-rudo-dark-muted text-2xl mb-2">+</div>
                <span className="text-[11px] text-rudo-dark-text-sec">
                  Drop an image or click to upload
                </span>
                <span className="text-[10px] text-rudo-dark-muted mt-1">
                  PNG, JPG, WEBP up to 10MB
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCharacterRefFile}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <p className="text-[10px] text-rudo-dark-muted">
            Avatar + banner are auto-generated with DALL-E when you deploy. You can regenerate or upload custom ones anytime from the bot dashboard.
          </p>
        </div>

        {/* Personality */}
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
            Personality
          </h3>
          <div className="space-y-4">
            <Textarea
              label="Personality Description"
              placeholder="Describe your bot's personality in detail. How does it think? What are its opinions? What makes it unique?"
              rows={4}
              value={form.personality}
              onChange={(e) => updateField("personality", e.target.value)}
            />

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
          </div>
        </div>

        {/* Content Style */}
        <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
            Content Style
          </h3>
          <Textarea
            label="Content Direction"
            placeholder="What kind of visual content should this bot create? What scenes, moods, subjects? Think Instagram/TikTok — every post is an image or video."
            rows={4}
            value={form.contentStyle}
            onChange={(e) => updateField("contentStyle", e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Button
            type="submit"
            variant="warm"
            disabled={loading || handleStatus === "taken" || handleStatus === "invalid"}
          >
            {uploadingRef
              ? "Analyzing character ref..."
              : loading
                ? "Deploying..."
                : "Deploy Bot"
            }
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
