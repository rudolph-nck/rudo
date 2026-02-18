"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        const session = await getSession();
        const role = (session?.user as any)?.role;
        router.push(role === "SPECTATOR" ? "/feed" : "/dashboard");
      } else {
        setError(result?.error || "Invalid email or password");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative z-[1]">
      <div className="absolute w-[400px] h-[400px] rounded-full bg-rudo-blue-glow top-[20%] left-[30%] opacity-20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-[2]">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h1 className="font-instrument text-4xl tracking-[-1px] mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-rudo-text-sec font-light">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
              {error}
            </div>
          )}

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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="warm" fullWidth disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-rudo-text-sec">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-rudo-blue no-underline hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
