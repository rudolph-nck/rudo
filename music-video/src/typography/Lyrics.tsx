import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp01, cubicOut } from "../utils/ease";
import { scene } from "../utils/scenes";
import { allLyrics, FPS } from "../utils/time";

/**
 * Global lyric layer: every sung line appears word-by-word at the sung time
 * (word onsets from ASR on the isolated vocal, data/lyrics.json). Lines whose
 * world already shows the full lyric as hero type set `caption: false` in
 * data/scenes.json and are skipped here.
 */
export const Lyrics: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  // current line = latest line that has started and is still held
  let cur: (typeof allLyrics)[number] | undefined;
  for (const l of allLyrics) if (l.start - 0.1 <= t) cur = l;
  if (!cur || t > cur.hold) return null;
  if (!scene(cur.id).caption) return null;
  const s = scene(cur.id);
  const heroWords = (s.heroWord || "").toLowerCase().split(" ").filter(Boolean);
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9’']/g, "");
  const words = cur.words.map((w, i) => ({ ...w, display: s.display.split(" ")[i] ?? w.w }));
  let hStart = -1;
  for (let i = 0; heroWords.length && i <= words.length - heroWords.length; i++)
    if (heroWords.every((hw, k) => norm(words[i + k].display) === norm(hw))) {
      hStart = i;
      break;
    }
  const out = clamp01((t - (cur.hold - 0.3)) / 0.3);
  const inT = clamp01((t - (cur.start - 0.1)) / 0.2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, opacity: inT * (1 - out),
        background: "linear-gradient(180deg, rgba(6,7,8,0) 0%, rgba(6,7,8,0.55) 55%, rgba(6,7,8,0.8) 100%)" }} />
      <div style={{ position: "absolute", left: 110, bottom: 74, width: 1500, opacity: 1 - out, transform: `translateY(${-out * 10}px)` }}>
        <div style={{ fontFamily: F.narrative, fontWeight: 400, fontSize: 40, lineHeight: 1.2, color: C.white, letterSpacing: "-0.005em" }}>
          {words.map((w, i) => {
            const p = cubicOut(clamp01((t - (w.t - 0.06)) / 0.18));
            const isHero = hStart >= 0 && i >= hStart && i < hStart + heroWords.length;
            return (
              <span key={i} style={{ display: "inline-block", marginRight: "0.26em", opacity: p, transform: `translateY(${(1 - p) * 0.35}em)`,
                color: isHero ? C.blue : undefined, fontWeight: isHero ? 600 : undefined }}>
                {w.display}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
