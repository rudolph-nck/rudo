"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
      }
    } catch {
      //
    }
  }

  async function toggleAd(id: string, isActive: boolean) {
    await fetch(`/api/admin/ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadAds();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1">
            Ad Manager
          </h1>
          <p className="text-sm text-rudo-text-sec font-light">
            Manage in-feed advertisements
          </p>
        </div>
        <Button variant="warm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Create Ad"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createAd}
          className="bg-rudo-surface border border-rudo-border p-6 mb-8 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <Button type="submit" variant="warm">
            Launch Ad
          </Button>
        </form>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-[2px] mb-8">
        {[
          {
            label: "Active Ads",
            value: ads.filter((a) => a.isActive).length,
          },
          {
            label: "Total Impressions",
            value: ads.reduce((s, a) => s + a.impressions, 0).toLocaleString(),
          },
          {
            label: "Total Clicks",
            value: ads.reduce((s, a) => s + a.clicks, 0).toLocaleString(),
          },
          {
            label: "Total Revenue",
            value: `$${ads.reduce((s, a) => s + a.spent, 0).toFixed(2)}`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-rudo-surface border border-rudo-border p-4"
          >
            <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-muted mb-1">
              {stat.label}
            </div>
            <div className="font-instrument text-2xl">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Ads list */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="status-dot mx-auto mb-4" />
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-rudo-surface border border-rudo-border p-12 text-center">
          <p className="text-rudo-text-sec text-sm font-light">No ads yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="bg-rudo-surface border border-rudo-border p-5 flex items-start gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-orbitron font-bold text-xs tracking-[1px]">
                    {ad.title}
                  </span>
                  <span
                    className={`text-[9px] font-orbitron tracking-wider px-2 py-0.5 border ${
                      ad.isActive
                        ? "text-green-400 border-green-400/20 bg-green-400/5"
                        : "text-rudo-muted border-rudo-border"
                    }`}
                  >
                    {ad.isActive ? "LIVE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-xs text-rudo-text-sec font-light mb-2 line-clamp-2">
                  {ad.content}
                </p>
                <div className="flex gap-4 text-[10px] text-rudo-muted font-orbitron tracking-wider">
                  <span>{ad.impressions.toLocaleString()} impressions</span>
                  <span>{ad.clicks} clicks</span>
                  <span>
                    CTR{" "}
                    {ad.impressions > 0
                      ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
                      : 0}
                    %
                  </span>
                  <span>
                    ${ad.spent.toFixed(2)} / ${ad.budget.toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleAd(ad.id, ad.isActive)}
                className={`px-3 py-1.5 text-[10px] font-orbitron tracking-wider border cursor-pointer transition-all ${
                  ad.isActive
                    ? "text-rudo-rose border-rudo-rose/20 bg-transparent hover:bg-rudo-rose-soft"
                    : "text-green-400 border-green-400/20 bg-transparent hover:bg-green-400/5"
                }`}
              >
                {ad.isActive ? "Pause" : "Resume"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
