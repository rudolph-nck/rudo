"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AdData = {
  id: string;
  title: string;
  content: string;
  advertiser: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  cpm: number;
  isActive: boolean;
  createdAt: string;
};

export default function AdManagerPage() {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    advertiser: "",
    ctaText: "",
    ctaUrl: "",
    budget: "100",
    cpm: "5",
  });

  useEffect(() => {
    loadAds();
  }, []);

  async function loadAds() {
    try {
      const res = await fetch("/api/admin/ads");
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  async function createAd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budget: parseFloat(form.budget),
          cpm: parseFloat(form.cpm),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ title: "", content: "", advertiser: "", ctaText: "", ctaUrl: "", budget: "100", cpm: "5" });
        loadAds();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create ad");
      }
    } catch {
      setError("Request failed");
    }
  }

  async function toggleAd(id: string, isActive: boolean) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await loadAds();
    } finally {
      setActionLoading(null);
    }
  }

  const activeCount = ads.filter((a) => a.isActive).length;
  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.spent, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="font-instrument text-2xl sm:text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Ad Manager
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Manage in-feed advertisements
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="self-start sm:self-auto px-3 sm:px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer"
        >
          {showForm ? "Cancel" : "Create Ad"}
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
      {showForm && (
        <form
          onSubmit={createAd}
          className="bg-rudo-card-bg border border-rudo-card-border p-4 sm:p-6 mb-6 sm:mb-8 space-y-4"
        >
          <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
            Create New Ad
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ad headline"
              required
            />
            <Input
              label="Advertiser"
              value={form.advertiser}
              onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
              placeholder="Company name"
              required
            />
          </div>
          <Textarea
            label="Content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Ad copy..."
            rows={3}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CTA Text"
              value={form.ctaText}
              onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
              placeholder="Learn More"
            />
            <Input
              label="CTA URL"
              value={form.ctaUrl}
              onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Budget ($)"
              type="number"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              required
            />
            <Input
              label="CPM ($)"
              type="number"
              value={form.cpm}
              onChange={(e) => setForm({ ...form, cpm: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer"
            >
              Launch Ad
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[2px] mb-6">
        {[
          { label: "Active Ads", value: activeCount },
          { label: "Total Impressions", value: totalImpressions.toLocaleString() },
          { label: "Total Clicks", value: totalClicks.toLocaleString() },
          { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-rudo-card-bg border border-rudo-card-border p-4"
          >
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
              {stat.label}
            </div>
            <div className="font-instrument text-2xl text-rudo-dark-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          {ads.length} ad{ads.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Ads list */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm">Loading ads...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <h3 className="font-instrument text-2xl mb-2 text-rudo-dark-text">No ads yet</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Create your first ad to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className={`flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-rudo-card-bg border hover:border-rudo-card-border-hover transition-all ${
                !ad.isActive ? "border-rudo-rose/20 opacity-60" : "border-rudo-card-border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text">
                    {ad.title}
                  </span>
                  <span
                    className={`text-[9px] font-orbitron tracking-wider px-2 py-0.5 border ${
                      ad.isActive
                        ? "text-green-400 border-green-400/20 bg-green-400/5"
                        : "text-rudo-dark-muted border-rudo-card-border"
                    }`}
                  >
                    {ad.isActive ? "LIVE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-xs text-rudo-dark-text-sec font-light mb-2 line-clamp-2">
                  {ad.content}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-rudo-blue">{ad.advertiser}</span>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-6 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
                  <span>{ad.impressions.toLocaleString()} imp</span>
                  <span>{ad.clicks} clicks</span>
                  <span>
                    CTR{" "}
                    {ad.impressions > 0
                      ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
                      : "0.00"}
                    %
                  </span>
                  <span>
                    ${ad.spent.toFixed(2)} / ${ad.budget.toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleAd(ad.id, ad.isActive)}
                disabled={actionLoading === ad.id}
                className={`self-start sm:self-auto px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  ad.isActive
                    ? "text-rudo-rose border-rudo-rose/20 bg-transparent hover:bg-rudo-rose-soft"
                    : "text-green-400 border-green-400/20 bg-transparent hover:bg-green-400/5"
                }`}
              >
                {actionLoading === ad.id ? "..." : ad.isActive ? "Pause" : "Resume"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
