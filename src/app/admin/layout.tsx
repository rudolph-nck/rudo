"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "\u25C9" },
  { href: "/admin/moderation", label: "Moderation", icon: "\u2691" },
  { href: "/admin/users", label: "Users", icon: "\u25CE" },
  { href: "/admin/bots", label: "Bots", icon: "\u25C8" },
  { href: "/admin/effects", label: "Effects", icon: "\u25C6" },
  { href: "/admin/generate", label: "Gen Tester", icon: "\u25B7" },
  { href: "/admin/ads", label: "Ads", icon: "\u25C7" },
  { href: "/admin/credits", label: "API Credits", icon: "\u25B2" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-rudo-surface border-b border-rudo-border flex items-center justify-between px-4 z-50 lg:hidden">
        <Logo />
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 bg-transparent border-none cursor-pointer"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-rudo-text transition-all ${sidebarOpen ? "rotate-45 translate-y-1" : ""}`} />
          <span className={`block w-5 h-0.5 bg-rudo-text transition-all ${sidebarOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-rudo-text transition-all ${sidebarOpen ? "-rotate-45 -translate-y-1" : ""}`} />
        </button>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 border-r border-rudo-border bg-rudo-surface flex flex-col fixed top-0 bottom-0 z-50 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo + Admin Label */}
        <div className="p-6 border-b border-rudo-border hidden lg:block">
          <Logo />
          <div className="mt-3 text-[10px] font-orbitron tracking-[3px] uppercase text-rudo-rose">
            Admin Panel
          </div>
        </div>
        <div className="p-6 border-b border-rudo-border lg:hidden h-14 flex items-center">
          <Logo />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
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

        {/* Bottom: User info + Actions */}
        <div className="p-4 border-t border-rudo-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-rudo-rose/20 flex items-center justify-center text-rudo-rose text-xs font-bold flex-shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-rudo-text truncate">
                {session?.user?.name || "Admin"}
              </p>
              <p className="text-[10px] text-rudo-rose font-orbitron uppercase tracking-wider">
                ADMIN
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-2 mt-2 text-sm font-outfit text-rudo-text-sec hover:text-rudo-text no-underline transition-all"
          >
            <span className="text-xs w-4 text-center">&larr;</span>
            Back to Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full mt-2 px-4 py-2 text-xs text-rudo-muted bg-transparent border border-rudo-border hover:border-rudo-rose hover:text-rudo-rose transition-all cursor-pointer font-outfit"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen bg-rudo-content-bg text-rudo-dark-text pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
