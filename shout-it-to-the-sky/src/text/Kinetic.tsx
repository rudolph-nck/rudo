import React, { useMemo } from "react";
import { C, SAFE } from "../theme";
import { Line } from "../data";
import { clamp01, cubicOut, mix } from "../utils/ease";
import { F } from "../utils/fonts";
import { measure } from "../utils/measure";

const SAFE_W = SAFE.right - SAFE.left;
const CX = (SAFE.left + SAFE.right) / 2;
const disp = (s: string) => s.toUpperCase();

/** Greedy word wrap at a given font; returns rows of word indices. */
const wrap = (words: string[], font: string, maxW: number, ls = 0) => {
  const rows: number[][] = [[]];
  let cur = "";
  words.forEach((w, i) => {
    const next = cur ? cur + " " + w : w;
    if (cur && measure(next, font, ls) > maxW) {
      rows.push([i]);
      cur = w;
    } else {
      rows[rows.length - 1].push(i);
      cur = next;
    }
  });
  return rows;
};

// ---------------------------------------------------------------------------------------------
/** Fast rap: words snap in on their timestamps, the previous line steps back. */
export const RapLine: React.FC<{ line: Line; t: number; out: number; centerY: number; color?: string; accent?: string; font?: "cond" | "mono" }> = ({
  line,
  t,
  out,
  centerY,
  color = C.bone,
  accent = C.steel,
  font = "cond",
}) => {
  const words = line.words.map((w) => disp(w.w));
  const fam = font === "mono" ? F.mono : F.cond;
  const weight = font === "mono" ? 500 : 700;
  const lay = useMemo(() => {
    const size = 92;
    const f = `${weight} ${size}px ${fam}`;
    const rows = wrap(words, f, SAFE_W * 0.92);
    const space = measure(" ", f);
    const lh = size * 1.12;
    const items: { wi: number; x: number; y: number }[] = [];
    rows.forEach((idx, ri) => {
      let x = SAFE.left + 10;
      idx.forEach((wi) => {
        items.push({ wi, x, y: centerY - (rows.length * lh) / 2 + ri * lh });
        x += measure(words[wi], f) + space;
      });
    });
    return { size, items };
  }, [line.id, centerY]);
  if (t < line.start - 0.01 || t > out + 0.5) return null;
  const pout = clamp01((t - out) / 0.18);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout * 0.8, transform: `translateY(${-pout * 230}px) scale(${1 - pout * 0.25})`, transformOrigin: `${SAFE.left}px ${centerY}px` }}>
      {lay.items.map((it) => {
        const dt = t - line.words[it.wi].s;
        if (dt < 0) return null;
        const p = clamp01(dt / 0.07);
        return (
          <div
            key={it.wi}
            style={{
              position: "absolute",
              left: it.x,
              top: it.y,
              fontFamily: fam,
              fontWeight: weight,
              fontSize: lay.size,
              lineHeight: 1,
              color: dt < 0.09 ? "#ffffff" : color,
              transform: `scale(${mix(1.35, 1, cubicOut(p))})`,
              transformOrigin: "0% 60%",
              textShadow: `0 0 ${dt < 0.12 ? 26 : 0}px ${accent}, 0 6px 18px rgba(0,0,0,0.7)`,
              whiteSpace: "nowrap",
            }}
          >
            {words[it.wi]}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** Sung lines that glide and glow (pre-chorus / bridge fallback). */
export const GlideLine: React.FC<{ line: Line; t: number; out: number; centerY: number; color?: string; glow?: string; hand?: boolean }> = ({
  line,
  t,
  out,
  centerY,
  color = C.bone,
  glow = "255,200,140",
  hand,
}) => {
  const words = hand ? line.words.map((w) => w.w) : line.words.map((w) => disp(w.w));
  const fam = hand ? F.hand : F.display;
  const lay = useMemo(() => {
    const size = hand ? 120 : 130;
    const f = `${hand ? 500 : 400} ${size}px ${fam}`;
    const rows = wrap(words, f, SAFE_W * 0.92);
    const space = measure(" ", f);
    const lh = size * (hand ? 1.05 : 0.98);
    const items: { wi: number; x: number; y: number }[] = [];
    rows.forEach((idx, ri) => {
      const ws = idx.map((i) => measure(words[i], f));
      let x = CX - (ws.reduce((a, b) => a + b, 0) + space * (idx.length - 1)) / 2;
      idx.forEach((wi, k) => {
        items.push({ wi, x, y: centerY - (rows.length * lh) / 2 + ri * lh });
        x += ws[k] + space;
      });
    });
    return { size, items };
  }, [line.id, centerY]);
  if (t < line.start - 0.01 || t > out + 0.8) return null;
  const pout = clamp01((t - out) / 0.7);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout, transform: `translateY(${-pout * 50 - Math.max(0, t - line.start) * 6}px)` }}>
      {lay.items.map((it) => {
        const dt = t - line.words[it.wi].s;
        if (dt < 0) return null;
        const p = cubicOut(clamp01(dt / 0.45));
        return (
          <div
            key={it.wi}
            style={{
              position: "absolute",
              left: it.x,
              top: it.y + (1 - p) * 24,
              fontFamily: fam,
              fontWeight: hand ? 500 : 400,
              fontSize: lay.size,
              lineHeight: 1,
              color,
              opacity: p,
              filter: `blur(${(1 - p) * 6}px)`,
              textShadow: `0 0 28px rgba(${glow},0.55)`,
              whiteSpace: "nowrap",
            }}
          >
            {words[it.wi]}
          </div>
        );
      })}
    </div>
  );
};

