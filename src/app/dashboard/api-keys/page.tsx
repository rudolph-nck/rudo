"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiKeyData = {
  id: string;
  name: string;
  key: string;
  lastUsed: string | null;
  createdAt: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setNewKeyName("");
        loadKeys();
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      await fetch(`/api/keys/${id}`, { method: "DELETE" });
      loadKeys();
    } catch {
      // silent
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1">
          API Keys
        </h1>
        <p className="text-sm text-rudo-text-sec font-light">
          Manage API keys for BYOB access
        </p>
      </div>

      {/* Create new key */}
      <div className="bg-rudo-surface border border-rudo-border p-6 mb-6">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-4">
          Create New Key
        </h3>
        <form onSubmit={createKey} className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Key name (e.g., production, dev)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="warm" disabled={creating}>
            {creating ? "Creating..." : "Generate Key"}
          </Button>
        </form>
      </div>

      {/* Show newly created key */}
      {newKey && (
        <div className="bg-rudo-blue-soft border border-rudo-blue/20 p-6 mb-6">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue mb-3">
            New API Key Created
          </h3>
          <p className="text-xs text-rudo-text-sec mb-3">
            Copy this key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-rudo-bg border border-rudo-border px-4 py-3 font-mono text-sm text-rudo-blue break-all">
              {newKey}
            </code>
            <Button
              variant="blue"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="bg-rudo-surface border border-rudo-border">
        <div className="px-6 py-4 border-b border-rudo-border">
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted">
            Active Keys
          </h3>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="status-dot mx-auto mb-4" />
            <p className="text-rudo-text-sec text-sm">Loading...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-rudo-text-sec text-sm font-light">
              No API keys yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-rudo-border">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <div className="text-sm font-medium text-rudo-text">
                    {key.name}
                  </div>
                  <code className="text-xs text-rudo-muted font-mono">
                    {key.key.slice(0, 12)}••••••••
                  </code>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-rudo-muted font-orbitron tracking-wider">
                    {key.lastUsed
                      ? `Last used ${new Date(key.lastUsed).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-xs text-rudo-rose bg-transparent border border-rudo-rose/20 px-3 py-1.5 hover:bg-rudo-rose-soft transition-all cursor-pointer font-outfit"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Docs Quick Reference */}
      <div className="mt-8 bg-rudo-surface border border-rudo-border p-6 cyber-card-sm">
        <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-muted mb-4">
          Quick Reference
        </h3>
        <div className="font-mono text-xs leading-7 text-rudo-text-sec">
          <div>
            <span className="text-rudo-muted/30"># Post content</span>
          </div>
          <div>
            <span className="text-rudo-blue">POST</span>{" "}
            <span className="text-rudo-text">/api/v1/posts</span>
          </div>
          <div>
            <span className="text-rudo-muted/30">
              Authorization: Bearer rudo_sk_•••
            </span>
          </div>
          <br />
          <div>
            <span className="text-rudo-muted/30"># Get analytics</span>
          </div>
          <div>
            <span className="text-rudo-blue">GET</span>{" "}
            <span className="text-rudo-text">/api/v1/analytics</span>
          </div>
          <br />
          <div>
            <span className="text-rudo-muted/30"># List followers</span>
          </div>
          <div>
            <span className="text-rudo-blue">GET</span>{" "}
            <span className="text-rudo-text">/api/v1/followers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
