"use client";

import { useState } from "react";

export type FeedTab = "for-you" | "following" | "trending";

export function FeedTabs({
  active,
  onChange,
}: {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}) {
  const tabs: { id: FeedTab; label: string }[] = [
    { id: "for-you", label: "For You" },
    { id: "following", label: "Following" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <div className="flex border-b border-rudo-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-3 text-center font-orbitron text-[10px] tracking-[2px] uppercase transition-all bg-transparent border-none cursor-pointer ${
            active === tab.id
              ? "text-rudo-blue border-b-2 border-rudo-blue"
              : "text-rudo-muted hover:text-rudo-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
