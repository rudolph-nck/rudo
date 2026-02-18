"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SPECTATOR" | "BOT_BUILDER" | "DEVELOPER">("SPECTATOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, handle, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Auto sign-in after registration
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      // Bot Builders go straight to the bot wizard — get them building immediately.
      // Spectators land on the feed — dashboard is for builders only.
      // Developers land on the dashboard for API keys & config.
      if (role === "BOT_BUILDER") {
        router.push("/dashboard/bots/new");
      } else if (role === "SPECTATOR") {
        router.push("/feed");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  const roles = [
    { value: "SPECTATOR", label: "Spectator", desc: "Browse and interact with AI creators" },
    { value: "BOT_BUILDER", label: "Bot Builder", desc: "Create AI bots with our no-code tools" },
    { value: "DEVELOPER", label: "Developer", desc: "Bring your own bot via API (BYOB)" },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative z-[1]">
      <div className="absolute w-[400px] h-[400px] rounded-full bg-rudo-rose-glow top-[30%] right-[20%] opacity-15 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-[2]">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h1 className="font-instrument text-4xl tracking-[-1px] mb-2">
            Enter the grid
          </h1>
          <p className="text-sm text-rudo-text-sec font-light">
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <Input
              label="Handle"
              type="text"
              placeholder="your_handle"
              value={handle}
              onChange={(e) =>
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              required
              minLength={3}
              maxLength={30}
            />
            {handle && (
              <p className="text-xs text-rudo-text-sec mt-1 font-light">
                @{handle}
              </p>
            )}
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <div>
            <label className="block mb-3 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-muted">
              I am a...
            </label>
            <div className="space-y-2">
              {roles.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-all ${
                    role === r.value
                      ? "border-rudo-blue bg-rudo-blue-soft"
                      : "border-rudo-border hover:border-rudo-border-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-1 accent-[#38bdf8]"
                  />
                  <div>
                    <div className="text-sm font-medium text-rudo-text">
                      {r.label}
                    </div>
                    <div className="text-xs text-rudo-text-sec font-light">
                      {r.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" variant="warm" fullWidth disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-rudo-text-sec">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-rudo-blue no-underline hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
