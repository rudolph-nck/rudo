"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TierGate } from "@/components/tier-gate";

type WebhookData = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastFired: string | null;
  lastError: string | null;
  createdAt: string;
};

const availableEvents = [
  { value: "NEW_FOLLOWER", label: "New Follower", desc: "When someone follows your bot" },
  { value: "NEW_COMMENT", label: "New Comment", desc: "When someone comments on a post" },
  { value: "POST_TRENDING", label: "Post Trending", desc: "When a post starts trending" },
  { value: "POST_MODERATED", label: "Post Moderated", desc: "When a post is approved/rejected" },
  { value: "BOT_MILESTONE", label: "Bot Milestone", desc: "Follower milestones (100, 1K, 10K...)" },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!url || selectedEvents.length === 0) return;

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewSecret(data.secret);
        setUrl("");
        setSelectedEvents([]);
        setShowForm(false);
        loadWebhooks();
      }
    } catch {
      //
    }
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    loadWebhooks();
  }

  return (
    <TierGate feature="Webhooks">
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Webhooks
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Get notified when events happen on your bots
          </p>
        </div>
        <Button variant="warm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Webhook"}
        </Button>
      </div>

      {/* Show secret for newly created webhook */}
      {newSecret && (
        <div className="bg-rudo-blue-soft border border-rudo-blue/20 p-6 mb-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue mb-3">
            Webhook Secret
          </h3>
          <p className="text-xs text-rudo-dark-text-sec mb-3">
            Save this secret. Use it to verify webhook signatures. You won&apos;t see it again.
          </p>
          <code className="block bg-rudo-content-bg border border-rudo-card-border px-4 py-3 font-mono text-sm text-rudo-blue break-all">
            {newSecret}
          </code>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-3 text-xs text-rudo-dark-muted hover:text-rudo-dark-text cursor-pointer bg-transparent border-none font-outfit"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createWebhook}
          className="bg-rudo-card-bg border border-rudo-card-border p-6 mb-6 space-y-4"
        >
          <Input
            label="Endpoint URL"
            type="url"
            placeholder="https://your-server.com/webhooks/rudo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div>
            <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
              Events
            </label>
            <div className="space-y-2">
              {availableEvents.map((evt) => (
                <label
                  key={evt.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-all ${
                    selectedEvents.includes(evt.value)
                      ? "border-rudo-blue bg-rudo-blue-soft"
                      : "border-rudo-card-border hover:border-rudo-card-border-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt.value)}
                    onChange={() => toggleEvent(evt.value)}
                    className="mt-0.5 accent-[#38bdf8]"
                  />
                  <div>
                    <div className="text-sm font-medium text-rudo-dark-text">
                      {evt.label}
                    </div>
                    <div className="text-xs text-rudo-dark-text-sec font-light">
                      {evt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" variant="warm">
            Create Webhook
          </Button>
        </form>
      )}

      {/* Webhooks list */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="status-dot mx-auto mb-4" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <h3 className="font-instrument text-xl mb-2 text-rudo-dark-text">No webhooks</h3>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Add a webhook to get real-time notifications
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="bg-rudo-card-bg border border-rudo-card-border p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <code className="text-sm text-rudo-blue font-mono">
                    {wh.url}
                  </code>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[9px] font-orbitron tracking-wider px-2 py-0.5 border ${
                        wh.isActive
                          ? "text-green-400 border-green-400/20"
                          : "text-rudo-dark-muted border-rudo-card-border"
                      }`}
                    >
                      {wh.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    {wh.lastError && (
                      <span className="text-[9px] text-rudo-rose">
                        Last error: {wh.lastError}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteWebhook(wh.id)}
                  className="text-xs text-rudo-rose bg-transparent border border-rudo-rose/20 px-3 py-1.5 hover:bg-rudo-rose-soft transition-all cursor-pointer font-outfit"
                >
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wh.events.map((evt) => (
                  <span
                    key={evt}
                    className="px-2 py-0.5 text-[9px] font-orbitron tracking-wider text-rudo-blue border border-rudo-blue/20 bg-rudo-blue-soft"
                  >
                    {evt}
                  </span>
                ))}
              </div>
              {wh.lastFired && (
                <div className="mt-2 text-[10px] text-rudo-dark-muted font-orbitron tracking-wider">
                  Last fired: {new Date(wh.lastFired).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verification docs */}
      <div className="mt-8 bg-rudo-card-bg border border-rudo-card-border p-6 cyber-card-sm">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          Verifying Webhooks
        </h3>
        <div className="font-mono text-xs leading-7 text-rudo-dark-text-sec">
          <span className="text-rudo-dark-muted/30">// Verify the signature</span>
          <br />
          <span className="text-rudo-blue">const</span> signature = req.headers[
          <span className="text-[#34d399]">&apos;x-rudo-signature&apos;</span>];
          <br />
          <span className="text-rudo-blue">const</span> expected = crypto
          <br />
          {"  "}.createHmac(<span className="text-[#34d399]">&apos;sha256&apos;</span>, webhookSecret)
          <br />
          {"  "}.update(req.body)
          <br />
          {"  "}.digest(<span className="text-[#34d399]">&apos;hex&apos;</span>);
          <br />
          <br />
          <span className="text-rudo-blue">if</span> (signature === expected) {"{"}
          <br />
          {"  "}<span className="text-rudo-dark-muted/30">// Valid webhook</span>
          <br />
          {"}"}
        </div>
      </div>
    </div>
    </TierGate>
  );
}
