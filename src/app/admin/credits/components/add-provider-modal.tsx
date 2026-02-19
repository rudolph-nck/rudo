"use client";

import { useState } from "react";

const PURPOSE_OPTIONS = [
  { value: "VIDEO_GENERATION", label: "Video Generation" },
  { value: "IMAGE_GENERATION", label: "Image Generation" },
  { value: "AUDIO_GENERATION", label: "Audio Generation" },
  { value: "TEXT_GENERATION", label: "Text Generation" },
  { value: "MULTI_PURPOSE", label: "Multi-purpose" },
];

type ProviderFormData = {
  providerName: string;
  displayName: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  purpose: string;
  capabilities: { video: boolean; image: boolean; audio: boolean; text: boolean };
  currentBalance: string;
  monthlyBudget: string;
  alertThreshold: string;
  priorityOrder: string;
};

const EMPTY_FORM: ProviderFormData = {
  providerName: "",
  displayName: "",
  apiKey: "",
  apiSecret: "",
  baseUrl: "",
  purpose: "MULTI_PURPOSE",
  capabilities: { video: false, image: false, audio: false, text: false },
  currentBalance: "",
  monthlyBudget: "",
  alertThreshold: "",
  priorityOrder: "1",
};

export function AddProviderModal({
  open,
  onClose,
  onSaved,
  editingProvider,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingProvider?: any;
}) {
  const [form, setForm] = useState<ProviderFormData>(
    editingProvider
      ? {
          providerName: editingProvider.providerName || "",
          displayName: editingProvider.displayName || "",
          apiKey: "",
          apiSecret: "",
          baseUrl: editingProvider.baseUrl || "",
          purpose: editingProvider.purpose || "MULTI_PURPOSE",
          capabilities: editingProvider.capabilities || {
            video: false,
            image: false,
            audio: false,
            text: false,
          },
          currentBalance: editingProvider.currentBalance?.toString() || "0",
          monthlyBudget: editingProvider.monthlyBudget?.toString() || "",
          alertThreshold: editingProvider.alertThreshold?.toString() || "",
          priorityOrder: editingProvider.priorityOrder?.toString() || "1",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const isEditing = !!editingProvider;

  async function handleTestConnection() {
    if (!isEditing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/credits/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: editingProvider.id }),
      });
      const data = await res.json();
      setTestResult(
        data.status === "connected"
          ? `Connected (${data.latencyMs}ms)`
          : `Failed: ${data.error}`
      );
    } catch {
      setTestResult("Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    const payload: any = {
      providerName: form.providerName,
      displayName: form.displayName,
      purpose: form.purpose,
      capabilities: form.capabilities,
      currentBalance: form.currentBalance ? parseFloat(form.currentBalance) : undefined,
      monthlyBudget: form.monthlyBudget ? parseFloat(form.monthlyBudget) : undefined,
      alertThreshold: form.alertThreshold ? parseFloat(form.alertThreshold) : undefined,
      priorityOrder: parseInt(form.priorityOrder) || 1,
    };

    if (form.apiKey) payload.apiKey = form.apiKey;
    if (form.apiSecret) payload.apiSecret = form.apiSecret;
    if (form.baseUrl) payload.baseUrl = form.baseUrl;

    try {
      const url = isEditing
        ? `/api/admin/credits/providers/${editingProvider.id}`
        : "/api/admin/credits/providers";
      const method = isEditing ? "PUT" : "POST";

      if (!isEditing && !form.apiKey) {
        setError("API Key is required");
        setSaving(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Failed to save provider");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm(`Delete ${editingProvider.displayName}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/credits/providers/${editingProvider.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch {
      setError("Failed to delete");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-10 overflow-y-auto">
      <div className="bg-rudo-card-bg border border-rudo-card-border w-full max-w-lg mx-3 sm:mx-4 mb-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-rudo-card-border">
          <h2 className="font-orbitron text-[10px] sm:text-xs tracking-[2px] uppercase text-rudo-dark-text">
            {isEditing ? "Edit API Connection" : "Add New API Connection"}
          </h2>
          <button
            onClick={onClose}
            className="text-rudo-dark-muted hover:text-rudo-dark-text bg-transparent border-none cursor-pointer text-lg"
          >
            x
          </button>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Provider Name
              </label>
              <input
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                placeholder="e.g., minimax"
                disabled={isEditing}
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Display Name
              </label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g., MiniMax"
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
              API Key {isEditing && "(leave blank to keep current)"}
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk_..."
              className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
              Base URL
            </label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
              Purpose
            </label>
            <select
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
            >
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
              Capabilities
            </label>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {(["video", "image", "audio", "text"] as const).map((cap) => (
                <label key={cap} className="flex items-center gap-1.5 text-sm text-rudo-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.capabilities[cap]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        capabilities: {
                          ...form.capabilities,
                          [cap]: e.target.checked,
                        },
                      })
                    }
                    className="accent-rudo-blue"
                  />
                  {cap.charAt(0).toUpperCase() + cap.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Current Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                placeholder="$0.00"
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Monthly Budget
              </label>
              <input
                type="number"
                value={form.monthlyBudget}
                onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })}
                placeholder="$"
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Alert Below
              </label>
              <input
                type="number"
                value={form.alertThreshold}
                onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })}
                placeholder="$"
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1.5">
                Priority
              </label>
              <input
                type="number"
                value={form.priorityOrder}
                onChange={(e) => setForm({ ...form, priorityOrder: e.target.value })}
                min="1"
                className="w-full px-3 py-2 text-sm font-outfit bg-white border border-rudo-card-border text-rudo-dark-text focus:border-rudo-blue/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Test connection (only for existing providers) */}
          {isEditing && (
            <div className="border-t border-rudo-card-border pt-4">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer disabled:opacity-40"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              {testResult && (
                <span
                  className={`ml-3 text-sm ${
                    testResult.startsWith("Connected")
                      ? "text-green-500"
                      : "text-rudo-rose"
                  }`}
                >
                  {testResult}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-6 border-t border-rudo-card-border">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                className="w-full sm:w-auto px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-rudo-blue-soft hover:bg-rudo-blue/10 transition-all cursor-pointer disabled:opacity-40"
            >
              {saving ? "Saving..." : isEditing ? "Update" : "Save Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
