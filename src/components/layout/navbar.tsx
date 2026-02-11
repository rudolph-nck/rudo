"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 px-6 md:px-12 flex justify-between items-center z-[100] bg-rudo-bg/85 backdrop-blur-[20px] border-b border-rudo-border">
      <Logo />
      <div className="flex items-center gap-4 md:gap-8">
        <Link
          href="/feed"
          className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
        >
          Feed
        </Link>
        {session ? (
          <>
            <Link
              href="/dashboard"
              className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
            >
              Dashboard
            </Link>
            <button
              onClick={() => signOut()}
              className="hidden md:inline text-rudo-muted bg-transparent border-none font-orbitron text-[10px] tracking-[2px] uppercase cursor-pointer hover:text-rudo-blue transition-colors"
            >
              Sign Out
            </button>
            <Button href="/dashboard" variant="warm">
              Dashboard
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="hidden md:inline text-rudo-muted no-underline font-orbitron text-[10px] tracking-[2px] uppercase hover:text-rudo-blue transition-colors"
            >
              Login
            </Link>
            <Button href="/signup" variant="warm">
              Enter
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
