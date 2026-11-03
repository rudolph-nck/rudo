import React from "react";
import { AbsoluteFill } from "remotion";
import { LINES } from "../data";
import { FMT } from "../theme";
import { F } from "../utils/fonts";
import { clamp01 } from "../utils/ease";

/** A small, clean lyric line at the bottom: the line being sung, each word appearing as it's sung,
 *  amber while it's sung, then settling to ink. Fades out when the line is done. */
export const LyricBar: React.FC<{ t: number; hideFrom?: number; hideTo?: number }> = ({ t, hideFrom = -1, hideTo = -1 }) => {
  let li = -1;
  for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].words[0].s - 0.04) li = i;
  if (li < 0) return null;
  const line = LINES[li];
  const next = LINES[li + 1]?.words[0].s ?? 1e9;
  const last = line.words[line.words.length - 1];
  const out = Math.min(next - 0.06, Math.max(last.e, last.s + 0.5) + 0.9);
  const o = (1 - clamp01((t - out) / 0.3)) * (t > hideFrom && t < hideTo ? 0 : 1);
  if (o <= 0.01) return null;
  const size = FMT.W > FMT.H ? 40 : 48;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FMT.H * 0.2, background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.5))", opacity: o }} />
      <div style={{ position: "absolute", left: FMT.W * 0.08, right: FMT.W * 0.08, bottom: FMT.H * (FMT.W > FMT.H ? 0.065 : 0.17), textAlign: "center", fontFamily: F.display, fontSize: size, letterSpacing: "0.14em", lineHeight: 1.1, opacity: o }}>
        {line.words.map((w, k) => {
          const a = clamp01((t - (w.s - 0.04)) / 0.12);
          const hot = t < w.s ? 0 : t < w.e ? 1 : Math.exp(-(t - w.e) / 0.4);
          // stone, lifting to bone while sung (Static & Silence palette)
          const c = `rgb(${Math.round(142 + (240 - 142) * hot)}, ${Math.round(125 + (124 - 125) * hot)}, ${Math.round(110 + (74 - 110) * hot)})`;
          return (
            <span key={k} style={{ color: c, opacity: a, display: "inline-block", transform: `translateY(${(1 - a) * 6}px)`, marginRight: "0.4em" }}>
              {w.w.toUpperCase()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
