"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
};

type EffectData = {
  id: string;
  name: string;
  categoryId: string;
  tierMinimum: string;
  generationType: string;
  description: string | null;
  cameraConfig: any;
  promptTemplate: { main?: string; scenes?: string[] };
  variants: { id: string; label: string; substitutions: Record<string, string> }[] | null;
  musicConfig: { mood: string; description: string } | null;
  durationOptions: number[];
  fps: number;
  costEstimateMin: number | null;
  costEstimateMax: number | null;
  isActive: boolean;
  isTrending: boolean;
  usageCount: number;
  category: Category;
  _count: { usages: number; posts: number };
};

const TIER_OPTIONS = ["spark", "pulse", "grid"] as const;
const GEN_TYPE_OPTIONS = [
  "text_to_video",
  "image_to_video",
  "start_end_frame",
  "multi_scene",
  "code_render",
] as const;

const TIER_COLORS: Record<string, string> = {
  spark: "text-yellow-500 border-yellow-500/20 bg-yellow-500/5",
  pulse: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft",
  grid: "text-green-400 border-green-400/20 bg-green-400/5",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EffectsPage() {
  const [effects, setEffects] = useState<EffectData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit / Create
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const loadEffects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterActive) params.set("active", filterActive);

      const res = await fetch(`/api/admin/effects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEffects(data.effects || []);
        setCategories(data.categories || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterCategory, filterActive]);

  useEffect(() => {
    loadEffects();
  }, [loadEffects]);

  // -------------------------------------------------------------------------
  // Toggle active / trending
  // -------------------------------------------------------------------------

  async function toggleField(id: string, field: "isActive" | "isTrending", current: boolean) {
    setActionLoading(`${id}-${field}`);
    try {
      const res = await fetch(`/api/admin/effects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      if (res.ok) await loadEffects();
    } finally {
      setActionLoading(null);
    }
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async function deleteEffect(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActionLoading(`${id}-delete`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/effects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
      } else {
        await loadEffects();
      }
    } finally {
      setActionLoading(null);
    }
  }

  // -------------------------------------------------------------------------
  // Seed
  // -------------------------------------------------------------------------

  async function seedEffects() {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/effects/seed", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Seed failed");
      } else {
        await loadEffects();
      }
    } catch {
      setError("Seed request failed");
    } finally {
      setSeeding(false);
    }
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  const activeCount = effects.filter((e) => e.isActive).length;
  const trendingCount = effects.filter((e) => e.isTrending).length;
  const totalUsages = effects.reduce((s, e) => s + e.usageCount, 0);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Effects Library
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Manage video effects — toggle, edit, or create new ones
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
          className="self-start sm:self-auto px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer"
        >
          {showCreate ? "Cancel" : "New Effect"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rudo-rose/10 border border-rudo-rose/20 text-rudo-rose text-sm px-4 py-3 mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline text-xs cursor-pointer bg-transparent border-none text-rudo-rose">dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <CreateEffectForm
          categories={categories}
          onCreated={() => { setShowCreate(false); loadEffects(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[2px] mb-6">
        {[
          { label: "Total Effects", value: effects.length },
          { label: "Active", value: activeCount },
          { label: "Trending", value: trendingCount },
          { label: "Total Usages", value: totalUsages.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="bg-rudo-card-bg border border-rudo-card-border p-3 sm:p-4">
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
              {stat.label}
            </div>
            <div className="font-instrument text-2xl text-rudo-dark-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit placeholder:text-rudo-dark-muted outline-none focus:border-rudo-card-border-hover transition-colors"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          {effects.length} effect{effects.length !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Effects list */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm">Loading effects...</p>
        </div>
      ) : effects.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <h3 className="font-instrument text-2xl mb-2 text-rudo-dark-text">No effects found</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-4">
            {!search && !filterCategory && !filterActive
              ? "Seed the built-in effects library to get started"
              : "Try adjusting your filters"}
          </p>
          {!search && !filterCategory && !filterActive && (
            <button
              onClick={seedEffects}
              disabled={seeding}
              className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seeding ? "Seeding..." : "Seed Effects Library"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {effects.map((fx) => (
            <div key={fx.id}>
              {editingId === fx.id ? (
                <EditEffectForm
                  effect={fx}
                  categories={categories}
                  onSaved={() => { setEditingId(null); loadEffects(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className={`p-3 sm:p-4 bg-rudo-card-bg border hover:border-rudo-card-border-hover transition-all ${
                  !fx.isActive ? "border-rudo-rose/20 opacity-60" : "border-rudo-card-border"
                }`}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Category icon */}
                    <div className="text-xl w-8 text-center flex-shrink-0" title={fx.category.name}>
                      {fx.category.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                          {fx.name}
                        </span>
                        <span className={`text-[9px] font-orbitron tracking-wider px-2 py-0.5 border ${TIER_COLORS[fx.tierMinimum] || ""}`}>
                          {fx.tierMinimum.toUpperCase()}
                        </span>
                        {fx.isTrending && (
                          <span className="text-[10px] font-orbitron tracking-wider text-orange-400 border border-orange-400/20 px-2 py-0.5">
                            TRENDING
                          </span>
                        )}
                        {!fx.isActive && (
                          <span className="text-[10px] font-orbitron tracking-wider text-rudo-rose border border-rudo-rose/20 px-2 py-0.5">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-rudo-blue truncate">{fx.id}</span>
                        <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted border border-rudo-card-border px-2 py-0.5">
                          {fx.generationType.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Stats — hidden on mobile, shown on larger screens */}
                    <div className="hidden lg:flex gap-6 text-xs text-rudo-dark-muted font-orbitron tracking-wider shrink-0">
                      <span>{fx.durationOptions.join("/")}s</span>
                      <span>{fx._count.posts} posts</span>
                      <span>{fx._count.usages} usages</span>
                      {fx.variants && <span>{fx.variants.length} var</span>}
                    </div>
                  </div>

                  {/* Stats row on mobile */}
                  <div className="flex lg:hidden flex-wrap gap-3 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider mt-2 ml-11">
                    <span>{fx.durationOptions.join("/")}s</span>
                    <span>{fx._count.posts} posts</span>
                    <span>{fx._count.usages} usages</span>
                    {fx.variants && <span>{fx.variants.length} var</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 ml-11 sm:ml-0 sm:mt-3 sm:justify-end">
                    <button
                      onClick={() => toggleField(fx.id, "isActive", fx.isActive)}
                      disabled={actionLoading === `${fx.id}-isActive`}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        fx.isActive
                          ? "text-green-400 border-green-400/20 bg-green-400/5 hover:bg-transparent"
                          : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:border-green-400/20 hover:text-green-400"
                      }`}
                    >
                      {actionLoading === `${fx.id}-isActive` ? "..." : fx.isActive ? "Active" : "Activate"}
                    </button>
                    <button
                      onClick={() => toggleField(fx.id, "isTrending", fx.isTrending)}
                      disabled={actionLoading === `${fx.id}-isTrending`}
                      className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        fx.isTrending
                          ? "text-orange-400 border-orange-400/20 bg-orange-400/5 hover:bg-transparent"
                          : "text-rudo-dark-muted border-rudo-card-border bg-transparent hover:border-orange-400/20 hover:text-orange-400"
                      }`}
                    >
                      {actionLoading === `${fx.id}-isTrending` ? "..." : "Trend"}
                    </button>
                    <button
                      onClick={() => { setEditingId(fx.id); setShowCreate(false); }}
                      className="px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border text-rudo-blue border-rudo-blue/20 bg-transparent hover:bg-rudo-blue-soft cursor-pointer transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEffect(fx.id, fx.name)}
                      disabled={actionLoading === `${fx.id}-delete`}
                      className="px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border text-red-500 border-red-500/20 bg-transparent hover:bg-red-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === `${fx.id}-delete` ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Effect Form
// ---------------------------------------------------------------------------

function CreateEffectForm({
  categories,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    categoryId: categories[0]?.id || "",
    tierMinimum: "spark" as string,
    generationType: "image_to_video" as string,
    description: "",
    promptMain: "",
    durationOptions: "10,15",
    fps: "24",
    isActive: true,
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleNameChange(name: string) {
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60);
    setForm((f) => ({ ...f, name, id }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          categoryId: form.categoryId,
          tierMinimum: form.tierMinimum,
          generationType: form.generationType,
          description: form.description || undefined,
          promptTemplate: { main: form.promptMain || undefined },
          durationOptions: form.durationOptions.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean),
          fps: parseInt(form.fps, 10) || 24,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create effect");
        return;
      }

      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6 mb-6 sm:mb-8 space-y-4">
      <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
        Create New Effect
      </div>

      {error && (
        <div className="text-rudo-rose text-sm bg-rudo-rose/10 border border-rudo-rose/20 px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Sunset Silhouette" required />
        <Input label="ID (auto)" value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="e.g. sunset_silhouette" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Category</label>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Tier Minimum</label>
          <select value={form.tierMinimum} onChange={(e) => set("tierMinimum", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Generation Type</label>
          <select value={form.generationType} onChange={(e) => set("generationType", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {GEN_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      <Textarea label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this effect look like?" rows={2} />
      <Textarea label="Prompt Template (main)" value={form.promptMain} onChange={(e) => set("promptMain", e.target.value)} placeholder="[SUBJECT] walking through a cinematic scene..." rows={3} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Duration Options (comma-separated)" value={form.durationOptions} onChange={(e) => set("durationOptions", e.target.value)} placeholder="10,15,30" />
        <Input label="FPS" type="number" value={form.fps} onChange={(e) => set("fps", e.target.value)} />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-green-400" />
          <span className="text-sm font-outfit text-rudo-dark-text">Active on creation</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Creating..." : "Create Effect"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit Effect Form (inline)
// ---------------------------------------------------------------------------

function EditEffectForm({
  effect,
  categories,
  onSaved,
  onCancel,
}: {
  effect: EffectData;
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: effect.name,
    categoryId: effect.categoryId,
    tierMinimum: effect.tierMinimum,
    generationType: effect.generationType,
    description: effect.description || "",
    promptMain: effect.promptTemplate?.main || "",
    promptScenes: effect.promptTemplate?.scenes?.join("\n---\n") || "",
    durationOptions: effect.durationOptions.join(","),
    fps: String(effect.fps),
    costEstimateMin: effect.costEstimateMin != null ? String(effect.costEstimateMin) : "",
    costEstimateMax: effect.costEstimateMax != null ? String(effect.costEstimateMax) : "",
    cameraMovement: effect.cameraConfig?.movement || "",
    cameraStart: effect.cameraConfig?.startFrame || "",
    cameraEnd: effect.cameraConfig?.endFrame || "",
    musicMood: effect.musicConfig?.mood || "",
    musicDescription: effect.musicConfig?.description || "",
    variantsJson: effect.variants ? JSON.stringify(effect.variants, null, 2) : "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const promptTemplate: any = {};
      if (form.promptMain) promptTemplate.main = form.promptMain;
      if (form.promptScenes) promptTemplate.scenes = form.promptScenes.split("\n---\n");

      let cameraConfig = null;
      if (form.cameraMovement || form.cameraStart || form.cameraEnd) {
        cameraConfig = {
          movement: form.cameraMovement,
          startFrame: form.cameraStart,
          endFrame: form.cameraEnd,
        };
      }

      let musicConfig = null;
      if (form.musicMood || form.musicDescription) {
        musicConfig = { mood: form.musicMood, description: form.musicDescription };
      }

      let variants = null;
      if (form.variantsJson.trim()) {
        try {
          variants = JSON.parse(form.variantsJson);
        } catch {
          setError("Invalid variants JSON");
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/admin/effects/${effect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          categoryId: form.categoryId,
          tierMinimum: form.tierMinimum,
          generationType: form.generationType,
          description: form.description || null,
          promptTemplate,
          cameraConfig,
          musicConfig,
          variants,
          durationOptions: form.durationOptions.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean),
          fps: parseInt(form.fps, 10) || 24,
          costEstimateMin: form.costEstimateMin ? parseFloat(form.costEstimateMin) : null,
          costEstimateMax: form.costEstimateMax ? parseFloat(form.costEstimateMax) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update effect");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-rudo-card-bg border-2 border-rudo-blue/30 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-blue">
          Editing: {effect.id}
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-rudo-dark-muted hover:text-rudo-dark-text cursor-pointer bg-transparent border-none font-outfit transition-colors">
          Cancel
        </button>
      </div>

      {error && (
        <div className="text-rudo-rose text-sm bg-rudo-rose/10 border border-rudo-rose/20 px-3 py-2">{error}</div>
      )}

      {/* Row 1: Name, Category, Tier, GenType */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Category</label>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Tier</label>
          <select value={form.tierMinimum} onChange={(e) => set("tierMinimum", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted block mb-2">Gen Type</label>
          <select value={form.generationType} onChange={(e) => set("generationType", e.target.value)} className="w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text text-sm font-outfit focus:outline-none focus:border-rudo-card-border-hover cursor-pointer transition-colors">
            {GEN_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Description */}
      <Textarea label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />

      {/* Row 3: Prompt template */}
      <Textarea label="Prompt Template (main)" value={form.promptMain} onChange={(e) => set("promptMain", e.target.value)} rows={3} placeholder="[SUBJECT] walking through a cinematic scene..." />
      {form.generationType === "multi_scene" && (
        <Textarea label="Scenes (separated by ---)" value={form.promptScenes} onChange={(e) => set("promptScenes", e.target.value)} rows={4} placeholder="Scene 1 prompt&#10;---&#10;Scene 2 prompt" />
      )}

      {/* Row 4: Camera config */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Camera Movement" value={form.cameraMovement} onChange={(e) => set("cameraMovement", e.target.value)} placeholder="e.g. dolly_in" />
        <Input label="Start Frame" value={form.cameraStart} onChange={(e) => set("cameraStart", e.target.value)} placeholder="e.g. wide establishing" />
        <Input label="End Frame" value={form.cameraEnd} onChange={(e) => set("cameraEnd", e.target.value)} placeholder="e.g. close-up face" />
      </div>

      {/* Row 5: Music config */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Music Mood" value={form.musicMood} onChange={(e) => set("musicMood", e.target.value)} placeholder="e.g. cinematic, epic" />
        <Input label="Music Description" value={form.musicDescription} onChange={(e) => set("musicDescription", e.target.value)} placeholder="e.g. Sweeping orchestral with rising strings" />
      </div>

      {/* Row 6: Duration, FPS, Cost */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input label="Durations (csv)" value={form.durationOptions} onChange={(e) => set("durationOptions", e.target.value)} placeholder="10,15,30" />
        <Input label="FPS" type="number" value={form.fps} onChange={(e) => set("fps", e.target.value)} />
        <Input label="Cost Min ($)" type="number" value={form.costEstimateMin} onChange={(e) => set("costEstimateMin", e.target.value)} placeholder="0.05" />
        <Input label="Cost Max ($)" type="number" value={form.costEstimateMax} onChange={(e) => set("costEstimateMax", e.target.value)} placeholder="0.30" />
      </div>

      {/* Row 7: Variants JSON */}
      <Textarea
        label="Variants (JSON array)"
        value={form.variantsJson}
        onChange={(e) => set("variantsJson", e.target.value)}
        rows={4}
        placeholder='[{ "id": "warm", "label": "Warm Tones", "substitutions": { "MOOD": "warm golden" } }]'
      />

      {/* Actions */}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}
