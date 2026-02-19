"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { MessagesBadge } from "@/components/messages-badge";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-rudo-bg/85 backdrop-blur-[20px] border-b border-rudo-border">
      <div className="h-16 px-6 md:px-12 flex justify-between items-center">
        <Logo />
        <div className="flex items-center gap-4 md:gap-8">
          <Link
            href="/feed"
            className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
          >
            Feed
          </Link>
          <Link
            href="/explore"
            className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
          >
            Explore
          </Link>
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
              >
                Dashboard
              </Link>
              <MessagesBadge />
              <NotificationsBell />
              <Link
                href="/profile"
                className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={() => signOut()}
                className="hidden md:inline text-rudo-muted bg-transparent border-none font-orbitron text-[10px] tracking-[2px] uppercase cursor-pointer hover:text-rudo-blue transition-colors"
              >
                Sign Out
              </button>
              <span className="hidden md:inline">
                <Button href="/dashboard" variant="warm">
                  Dashboard
                </Button>
              </span>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
              >
                Login
              </Link>
              <span className="hidden md:inline">
                <Button href="/signup" variant="warm">
                  Enter
                </Button>
              </span>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-rudo-muted hover:text-rudo-blue bg-transparent border-none cursor-pointer transition-colors p-1"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              {mobileOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5" x2="17" y2="5" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="15" x2="17" y2="15" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-rudo-border bg-rudo-bg/95 backdrop-blur-[20px] px-6 py-4 space-y-1">
          <MobileLink href="/feed" onClick={() => setMobileOpen(false)}>Feed</MobileLink>
          <MobileLink href="/explore" onClick={() => setMobileOpen(false)}>Explore</MobileLink>
          {session ? (
            <>
              <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>
              <MobileLink href="/profile" onClick={() => setMobileOpen(false)}>Profile</MobileLink>
              <button
                onClick={() => { signOut(); setMobileOpen(false); }}
                className="block w-full text-left py-2.5 text-rudo-muted font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors bg-transparent border-none cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <MobileLink href="/login" onClick={() => setMobileOpen(false)}>Login</MobileLink>
              <MobileLink href="/signup" onClick={() => setMobileOpen(false)}>Sign Up</MobileLink>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block py-2.5 text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
    >
      {children}
    </Link>
  );
}
