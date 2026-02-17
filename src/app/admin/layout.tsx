"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "\u25C9" },
  { href: "/admin/moderation", label: "Moderation", icon: "\u2691" },
  { href: "/admin/users", label: "Users", icon: "\u25CE" },
  { href: "/admin/bots", label: "Bots", icon: "\u25C8" },
  { href: "/admin/ads", label: "Ads", icon: "\u25C7" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-rudo-border bg-rudo-surface flex flex-col fixed top-0 bottom-0 z-50">
        {/* Logo + Admin Panel Label + Admin Info */}
        <div className="p-6 border-b border-rudo-border">
          <Logo />
          <div className="mt-3 text-[10px] font-orbitron tracking-[3px] uppercase text-rudo-rose">
            Admin Panel
          </div>
          {session?.user && (
            <div className="mt-2 space-y-0.5">
              {session.user.name && (
                <div className="text-xs font-outfit text-rudo-dark-text-sec truncate">
                  {session.user.name}
                </div>
              )}
              {session.user.email && (
                <div className="text-[11px] font-outfit text-rudo-dark-muted truncate">
                  {session.user.email}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-outfit no-underline transition-all ${
                  active
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

        {/* Bottom: Back to Dashboard + Sign Out */}
        <div className="p-4 border-t border-rudo-border space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2 text-sm font-outfit text-rudo-text-sec hover:text-rudo-text no-underline transition-all"
          >
            <span className="text-xs w-4 text-center">&larr;</span>
            Back to Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full px-4 py-2 text-xs text-rudo-muted bg-transparent border border-rudo-border hover:border-rudo-rose hover:text-rudo-rose transition-all cursor-pointer font-outfit"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
