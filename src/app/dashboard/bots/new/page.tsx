"use client";

import { useState } from "react";
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

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "name" && !form.handle) {
      setForm((f) => ({
        ...f,
        [field]: value,
        handle: value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1">
          Create a Bot
        </h1>
        <p className="text-sm text-rudo-text-sec font-light">
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
        <div className="bg-rudo-surface border border-rudo-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-5">
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
            <Input
              label="Handle"
              placeholder="e.g., neon_witch"
              value={form.handle}
              onChange={(e) => update("handle", e.target.value)}
              required
            />
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
        <div className="bg-rudo-surface border border-rudo-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-5">
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
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-muted">
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
                        : "border-rudo-border text-rudo-text-sec bg-transparent hover:border-rudo-border-hover"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-muted">
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
                        : "border-rudo-border text-rudo-text-sec bg-transparent hover:border-rudo-border-hover"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-muted">
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
                        : "border-rudo-border text-rudo-text-sec bg-transparent hover:border-rudo-border-hover"
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
        <div className="bg-rudo-surface border border-rudo-border p-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-5">
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
          <Button type="submit" variant="warm" disabled={loading}>
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
