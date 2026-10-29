import React, { useMemo } from "react";
import { Line } from "../data";
import { SAFE } from "../theme";
import { F } from "../utils/fonts";
import { measure } from "../utils/measure";
import { clamp01, cubicOut } from "../utils/ease";

export const INK = "#efede9";
export const STONE = "#c4b6a2";
export const DIM = "rgba(239,237,233,0.45)";
const GHOST = "rgba(239,237,233,0.13)";

const fmt = (s: number) => `t-${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;

/** Fit words into ≤ maxRows rows inside maxW, as large as possible (≤ maxSize). */
const fitRows = (words: string[], maxW: number, maxSize: number, maxRows: number, weight: number) => {
  for (let size = maxSize; size >= 34; size -= 4) {
    const font = `${weight} ${size}px ${F.grotesk}`;
    const space = measure(" ", font);
    const rows: number[][] = [[]];
    let cur = 0, ok = true;
    words.forEach((w, i) => {
      const ww = measure(w, font, -0.02);
      if (ww > maxW) ok = false;
      const row = rows[rows.length - 1];
      if (row.length && cur + space + ww > maxW) {
        rows.push([i]);
        cur = ww;
      } else {
        row.push(i);
        cur += (row.length > 1 ? space : 0) + ww;
      }
    });
    if (ok && rows.length <= maxRows) return { size, rows, space };
  }
  const font = `${weight} 34px ${F.grotesk}`;
  return { size: 34, rows: [words.map((_, i) => i)], space: measure(" ", font) };
};

/**
 * A sung line in the reference style. Each word appears (ghosted) exactly on its sung time and
 * fills letter by letter over its duration; the last word lands in stone. A tiny timecode sits
 * under each word. The block always fits inside the safe frame.
 */
export const LyricLine: React.FC<{
  line: Line;
  t: number;
  top: number;
  out: number;
  maxSize?: number;
  maxRows?: number;
  align?: "left" | "center";
  accentAll?: RegExp;
  timecodes?: boolean;
  weight?: number;
  special?: { re: RegExp; color: string };
}> = ({ line, t, top, out, maxSize = 112, maxRows = 3, align = "left", accentAll, timecodes = true, weight = 800, special }) => {
  const words = useMemo(() => line.words.map((w) => w.w.toUpperCase()), [line.id]);
  const maxW = SAFE.right - SAFE.left;
  const lay = useMemo(() => fitRows(words, maxW, maxSize, maxRows, weight), [line.id, maxSize, maxRows]);
  if (t < line.start - 0.01 || t > out + 0.25) return null;
  const q = clamp01((t - out) / 0.2);
  const font = `${weight} ${lay.size}px ${F.grotesk}`;
  const lh = lay.size * 1.0 + (timecodes ? 22 : 0);
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: top - q * 40, width: maxW, opacity: 1 - q }}>
      {lay.rows.map((row, ri) => {
        const rowW = row.reduce((a, i) => a + measure(words[i], font, -0.02), 0) + lay.space * (row.length - 1);
        let x = align === "center" ? (maxW - rowW) / 2 : 0;
        return row.map((wi) => {
          const w = line.words[wi];
          const ww = measure(words[wi], font, -0.02);
          const x0 = x;
          x += ww + lay.space;
          const dt = t - w.s;
          if (dt < 0) return null;
          const accent = wi === words.length - 1 || (accentAll && accentAll.test(w.w));
          const dur = Math.max(0.1, (w.e - w.s) * 0.85);
          const n = words[wi].length;
          const pin = cubicOut(clamp01(dt / 0.08));
          return (
            <div key={wi} style={{ position: "absolute", left: x0, top: ri * lh + (1 - pin) * 14, opacity: pin, whiteSpace: "pre" }}>
              <div style={{ fontFamily: F.grotesk, fontWeight: weight, fontSize: lay.size, lineHeight: 1, letterSpacing: "-0.02em", textShadow: "0 8px 30px rgba(0,0,0,0.7)" }}>
                {[...words[wi]].map((ch, li) => {
                  const lit = t >= w.s + (dur * li) / n;
                  return (
                    <span key={li} style={{ color: lit ? (special && special.re.test(w.w) ? special.color : accent ? STONE : INK) : GHOST }}>
                      {ch}
                    </span>
                  );
                })}
              </div>
              {timecodes ? <div style={{ fontFamily: F.mono, fontSize: 15, color: DIM, marginTop: 4 }}>{fmt(w.s)}</div> : null}
            </div>
          );
        });
      })}
    </div>
  );
};

/** When a line should leave: just before the next one starts. */
export const lineOut = (l: Line, next?: Line, hold = 1.0) => (next ? Math.min(next.start - 0.05, l.end + hold) : l.end + hold);
