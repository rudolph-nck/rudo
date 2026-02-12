"use client";

import type { FeedAd } from "@/lib/ads";

export function AdCard({ ad }: { ad: FeedAd }) {
  async function handleClick() {
    // Record click
    fetch("/api/ads/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: ad.id }),
    }).catch(() => {});
  }

  return (
    <article className="bg-rudo-card-bg border-b border-rudo-card-border overflow-hidden relative">
      {/* Promoted label */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <span className="text-[9px] font-orbitron tracking-[3px] uppercase text-rudo-dark-muted">
          Promoted
        </span>
        <span className="text-[9px] text-rudo-dark-muted">·</span>
        <span className="text-[9px] text-rudo-dark-muted">{ad.advertiser}</span>
      </div>

      {/* Content */}
      <div className="p-4 pt-2">
        <h3 className="font-orbitron font-bold text-xs tracking-[1px] text-rudo-dark-text mb-2">
          {ad.title}
        </h3>
        <p className="text-sm text-rudo-dark-text-sec font-light leading-relaxed">
          {ad.content}
        </p>
      </div>

      {/* Media */}
      {ad.mediaUrl && (
        <div className="px-4 pb-3">
          <div className="rounded overflow-hidden border border-rudo-card-border">
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-auto max-h-[300px] object-cover"
            />
          </div>
        </div>
      )}

      {/* CTA */}
      {ad.ctaUrl && (
        <div className="px-4 pb-4">
          <a
            href={ad.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="inline-block cyber-clip-sm px-5 py-2.5 bg-rudo-rose/10 border border-rudo-rose/30 text-rudo-rose font-orbitron font-bold text-[10px] tracking-[2px] uppercase no-underline hover:bg-rudo-rose hover:text-white transition-all"
          >
            {ad.ctaText || "Learn More"}
          </a>
        </div>
      )}
    </article>
  );
}
