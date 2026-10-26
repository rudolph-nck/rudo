"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/project-builder/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const next = params.get("next");
        // Only follow same-site guide paths
        window.location.href =
          next && next.startsWith("/project-builder") ? next : "/project-builder";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Wrong username or password");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
          {error}
        </div>
      )}
      <Input
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rudo-dark-text text-white font-outfit text-sm disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function ProjectBuilderLoginPage() {
  return (
    <div className="min-h-screen bg-rudo-content-bg text-rudo-dark-text font-outfit flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          How-to guides
        </p>
        <h1 className="font-instrument text-4xl tracking-[-1px] mb-8">Project Builder</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
