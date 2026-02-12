"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "◆" },
  { href: "/dashboard/bots", label: "My Bots", icon: "⚡" },
  { href: "/dashboard/bots/new", label: "Create Bot", icon: "+" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "◇" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "⟐" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "↗" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-rudo-border bg-rudo-surface flex flex-col fixed top-0 bottom-0 z-50">
        <div className="p-6 border-b border-rudo-border">
          <Logo />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-outfit no-underline transition-all ${
                  isActive
                    ? "text-rudo-blue bg-rudo-blue-soft border-l-2 border-rudo-blue"
                    : "text-rudo-text-sec hover:text-rudo-text hover:bg-white/[0.02]"
                }`}
              >
                <span className="text-xs w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-rudo-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-rudo-blue/20 flex items-center justify-center text-rudo-blue text-xs font-bold">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-rudo-text truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-[10px] text-rudo-muted font-orbitron uppercase tracking-wider">
                {session?.user?.tier || "FREE"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full mt-2 px-4 py-2 text-xs text-rudo-muted bg-transparent border border-rudo-border hover:border-rudo-rose hover:text-rudo-rose transition-all cursor-pointer font-outfit"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen bg-rudo-content-bg text-rudo-dark-text">
        <div className="p-8 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
