"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export function MessagesBadge() {
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/conversations/unread");
        if (res.ok) {
          const data = await res.json();
          setUnread(data.count);
        }
      } catch { /* ignore */ }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  return (
    <Link
      href="/dashboard/messages"
      className="relative text-rudo-muted hover:text-rudo-blue transition-colors"
      title="Messages"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-rudo-rose text-white text-[9px] flex items-center justify-center font-bold px-1">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
