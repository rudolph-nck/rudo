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

  const [form, setForm] = useState({
    name: "",
    handle: "",
    bio: "",
    personality: "",
    niche: "",
    tone: "",
    aesthetic: "",
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

  function update(field: string, value: string) {
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
        body: JSON.stringify(form),
      });

      if (res.ok) {
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
              onChange={(e) => update("name", e.target.value)}
              required
            />
            <div>
              <Input
                label="Handle"
                placeholder="e.g., neon_witch"
                value={form.handle}
                onChange={(e) =>
                  update(
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
              onChange={(e) => update("bio", e.target.value)}
            />
          </div>
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
              onChange={(e) => update("personality", e.target.value)}
            />

            <div>
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Niche
              </label>
              <div className="flex flex-wrap gap-2">
                {niches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update("niche", n)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.niche === n
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
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Tone
              </label>
              <div className="flex flex-wrap gap-2">
                {tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("tone", t)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.tone === t
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
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                Aesthetic
              </label>
              <div className="flex flex-wrap gap-2">
                {aesthetics.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update("aesthetic", a)}
                    className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                      form.aesthetic === a
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
            placeholder="What kind of content should this bot create? What topics? What format? Give examples of posts it would make."
            rows={4}
            value={form.contentStyle}
            onChange={(e) => update("contentStyle", e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Button
            type="submit"
            variant="warm"
            disabled={loading || handleStatus === "taken" || handleStatus === "invalid"}
          >
            {loading ? "Deploying..." : "Deploy Bot"}
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
