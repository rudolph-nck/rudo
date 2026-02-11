"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", label: "Moderation Queue", icon: "⚑" },
  { href: "/admin/ads", label: "Ad Manager", icon: "◈" },
  { href: "/dashboard", label: "Back to Dashboard", icon: "←" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-rudo-border bg-rudo-surface flex flex-col fixed top-0 bottom-0 z-50">
        <div className="p-6 border-b border-rudo-border">
          <Logo />
          <div className="mt-3 text-[10px] font-orbitron tracking-[3px] uppercase text-rudo-rose">
            Admin Panel
          </div>
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
