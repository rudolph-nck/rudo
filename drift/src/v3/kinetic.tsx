import React from "react";
import { AbsoluteFill } from "remotion";
import { LINES, T, bassLevel, kickEnv } from "../data";
import { useAssets } from "../three/assets";
import { layout } from "../words/glyphs";
import { clamp01, cubicIn, cubicInOut, cubicOut } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { FF, P } from "./kit";
import { mixC } from "./verse1";

/**
 * Kinetic lyrics: every sung word is big, front and centre, revealed letter by letter as its syllables are sung,
 * and it MOVES THE WAY IT MEANS (TIRED sags, DRIFT lifts off letter by letter and floats away, NO slams down,
 * DEADLINES shatters, DISCONNECTED pulls apart, FORGET dissolves, WEIGHT drops in heavy...).
 * Word currently sung: ember. Settled words: bone. Lines leave the way the section moves (float up / sink).
 */
export type Beh = "pop" | "sag" | "float" | "fall" | "squeeze" | "split" | "shatter" | "jitter" | "dissolve" | "stretch" | "echo" | "stamp" | "rise" | "twinkle" | "beat" | "type" | "freeze" | "tilt";
export type KSpec = {
  li: number;
  rows: number[][]; // word indices per row
  sizes: number[]; // font size per row (px)
  beh?: Record<number, Beh>; // per word index
  x?: number; y?: number; // block centre (px)
  align?: "center" | "left" | "right";
  exit?: "up" | "down" | "fade" | "hold";
  until?: number; // hold the line on screen until this time (default: next line's start)
};

const W = (li: number, wi: number) => LINES[li].words[wi];
const clean = (s: string) => s.toUpperCase().replace(/[.,!?…]/g, "");

/** Which syllable each letter belongs to (so letters appear when their syllable is sung). */
const sylStarts = (li: number, wi: number) => {
  const w = W(li, wi), text = clean(w.w);
  const syl = w.syl && w.syl.length ? w.syl : [{ t: w.w, s: w.s, e: w.e }];
  const lens = syl.map((s) => clean(s.t).length || 1);
  const total = lens.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let k = 0, acc = 0;
  for (let i = 0; i < text.length; i++) {
    while (k < syl.length - 1 && i >= Math.round(((acc + lens[k]) / total) * text.length)) { acc += lens[k]; k++; }
    out.push(syl[k].s);
  }
  return out;
};

export const KLine: React.FC<{ t: number; spec: KSpec; next?: number }> = ({ t, spec, next }) => {
  const a = useAssets();
  if (!a) return null;
  const { li } = spec;
  const ws = LINES[li].words;
  const start = ws[0].s - 0.06;
  const end = spec.until ?? next ?? ws[ws.length - 1].e + 0.8;
  const floats = Object.values(spec.beh ?? {}).includes("float");
  if (t < start - 0.05 || t > end + (floats ? 4.5 : 0.5)) return null;
  const exitK = spec.exit === "hold" ? 0 : cubicIn(clamp01((t - (end - 0.22)) / 0.3));
  const cx = spec.x ?? 960, cy = spec.y ?? 330;
  const floaters: React.ReactNode[] = [];
  // measure rows
  const rows = spec.rows.map((r, ri) => {
    const size = spec.sizes[ri] ?? spec.sizes[spec.sizes.length - 1];
    const words = r.map((wi) => ({ wi, text: clean(W(li, wi).w), lay: layout(a.bebas, clean(W(li, wi).w), size, 0.05) }));
    const gap = size * 0.3;
    let width = words.reduce((s, w) => s + w.lay.width, 0) + gap * (words.length - 1);
    const fit = Math.min(1, 1720 / width);
    width *= fit;
    return { size: size * fit, words: words.map((w) => ({ ...w, lay: fit < 1 ? layout(a.bebas, w.text, size * fit, 0.05) : w.lay })), gap: gap * fit, width };
  });
  const lh = (s: number) => s * 0.98;
  const totalH = rows.reduce((s, r) => s + lh(r.size), 0);
  let yCursor = cy - totalH / 2;
  const els: React.ReactNode[] = [];
  rows.forEach((row, ri) => {
    const y = yCursor + lh(row.size) / 2;
    yCursor += lh(row.size);
    let x = spec.align === "left" ? 140 : spec.align === "right" ? 1780 - row.width : cx - row.width / 2;
    row.words.forEach(({ wi, text, lay }) => {
      const w = W(li, wi);
      const beh = spec.beh?.[wi] ?? "pop";
      const size = row.size;
      const starts = sylStarts(li, wi);
      const n = text.length;
      const u = t - w.s, hold = Math.max(0.15, w.e - w.s), after = t - w.e;
      const sung = t >= w.s - 0.04 && t < w.e;
      const col = t < w.e ? P.ember : mixC(P.ember, P.bone, clamp01(after / 0.6));
      const wx = x + lay.width / 2;
      // word-level effects
      let wdx = 0, wdy = 0, wrot = 0, wsx = 1, wsy = 1;
      if (beh === "fall") { const k = cubicIn(clamp01((t - (w.s - 0.25)) / 0.25)); wdy = -(1 - k) * size * 2.2; const imp = Math.max(0, t - w.s); wsy = 1 - 0.14 * Math.exp(-imp / 0.08) * (imp > 0 ? 1 : 0); wsx = 1 + 0.06 * Math.exp(-imp / 0.08) * (imp > 0 ? 1 : 0); }
      if (beh === "stamp") { const k = clamp01((t - w.s) / 0.12); wsx = wsy = 1 + 0.7 * (1 - cubicOut(k)); wrot = -6 * cubicOut(k); }
      if (beh === "freeze") { const k = clamp01((t - w.s) / 0.06); wsx = wsy = 1 + 0.25 * (1 - k); }
      if (beh === "rise") { const k = cubicOut(clamp01((t - w.s) / 0.7)); wdy = (1 - k) * size * 0.5; }
      if (beh === "squeeze") { const k = cubicOut(clamp01((u - 0.05) / 0.4)); wsx = 1 - 0.28 * k; wsy = 1 + 0.06 * k; }
      if (beh === "beat") { wsx = wsy = 1 + 0.1 * kickEnv(t) * (t > w.s ? 1 : 0); }
      if (beh === "tilt") { const k = cubicInOut(clamp01((u - 0.2) / 1.2)); wrot = -9 * k; wdy = k * size * 0.1; }
      // echo copies (CALL, RINGING, VOICES)
      if (beh === "echo" && t > w.s) {
        T.beats.filter((b) => b >= w.s - 0.05 && b < w.e + 0.6).forEach((b, k) => {
          const d = t - b; if (d < 0 || d > 1.1) return;
          const s = 1 + d * 0.9;
          els.push(<div key={`e${wi}-${k}`} style={{ position: "absolute", left: wx, top: y, transform: `translate(-50%,-50%) scale(${s})`, font: `400 ${size}px/1 ${FF.display}`, letterSpacing: "0.05em", color: P.stone, opacity: 0.35 * (1 - d / 1.1), whiteSpace: "nowrap" }}>{text}</div>);
        });
      }
      lay.letters.forEach((L, i) => {
        const ls = starts[i] ?? w.s;
        let ap = cubicOut(clamp01((t - (ls - 0.04)) / 0.16));
        if (beh === "type") ap = t >= w.s + (i / n) * Math.min(hold, 0.8) ? 1 : 0;
        if (beh === "fall" || beh === "stamp" || beh === "freeze") ap = t >= w.s - 0.02 ? 1 : 0;
        if (ap <= 0) return;
        let dx = 0, dy = (1 - ap) * size * 0.22, rot = 0, op = ap, blur = 0, sc = 1;
        const r = rng(li * 131 + wi * 17 + i);
        const ci = i - (n - 1) / 2;
        if (beh === "sag") { const k = cubicInOut(clamp01((u - 0.3) / 1.4)); dy += k * size * 0.2 * Math.sin(Math.PI * (i + 0.5) / n) + k * size * 0.04; rot += k * ci * -5; dx += k * ci * size * 0.05; }
        if (beh === "float") {
          const v = Math.max(0, t - (w.s + 0.28 + i * 0.16)); // D, then R, then I… lift off one by one
          dy -= 26 * v + 16 * v * v; dx += Math.sin(v * 1.1 + i * 1.7) * 18 * Math.min(1, v); rot += Math.sin(v * 0.8 + i) * 14 * Math.min(1, v);
          op *= 1 - clamp01((v - 2.4) / 1.6);
        }
        if (beh === "split") { const k = cubicInOut(clamp01(u / Math.max(0.6, hold))); dx += ci * size * 0.32 * k; dy += (i % 2 ? 1 : -1) * size * 0.05 * k; rot += ci * 2 * k; }
        if (beh === "stretch") { const k = cubicInOut(clamp01(u / hold)) * (1 - cubicInOut(clamp01(after / 0.5))); dx += ci * size * 0.22 * k; if (n === 1) sc *= 1 + 0.6 * k; }
        if (beh === "jitter" && t > ls) { const amp = size * (0.03 + 0.05 * bassLevel(t)); dx += (noise1(t * 9, i * 3.1) - 0.5) * amp * 2; dy += (noise1(t * 9, i * 7.3) - 0.5) * amp * 2; rot += (noise1(t * 7, i) - 0.5) * 16; }
        if (beh === "twinkle") { op *= 0.75 + 0.25 * Math.sin(t * 6 + i * 2.1); sc *= 1 + 0.04 * Math.sin(t * 5 + i); }
        if (beh === "shatter") { const v = Math.max(0, t - (w.e + 0.05)); if (v > 0) { dx += (r() - 0.5) * 700 * v; dy += 900 * v * v - (150 + r() * 200) * v; rot += (r() - 0.5) * 500 * v; op *= 1 - clamp01(v / 0.9); } }
        if (beh === "dissolve") { const v = Math.max(0, t - (w.e + i * 0.06)); if (v > 0) { blur = v * 14; op *= 1 - clamp01(v / 0.7); dy -= v * 40; } }
        (beh === "float" ? floaters : els).push(
          <div key={`${wi}-${i}`} style={{ position: "absolute", left: wx, top: y, transform: `translate(-50%,-50%) translate(${wdx}px, ${wdy}px) rotate(${wrot}deg) scale(${wsx}, ${wsy})`, transformOrigin: "50% 60%" }}>
            <div style={{ position: "absolute", left: L.x + dx, top: dy, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`, font: `400 ${size}px/1 ${FF.display}`, color: sung && beh !== "dissolve" ? P.ember : col, opacity: op, filter: blur ? `blur(${blur}px)` : undefined, textShadow: "0 6px 30px rgba(0,0,0,0.55)", whiteSpace: "nowrap" }}>{L.ch}</div>
          </div>,
        );
      });
      x += lay.width + row.gap;
    });
  });
  const exitT = spec.exit === "down" ? `translateY(${exitK * 140}px)` : spec.exit === "fade" ? "" : `translateY(${-exitK * 180}px)`;
  // floating letters are not bound to the line: they keep drifting up and away after the line has gone
  return <><AbsoluteFill style={{ opacity: 1 - exitK, transform: exitT, filter: exitK > 0 ? `blur(${exitK * 6}px)` : undefined, pointerEvents: "none" }}>{els}</AbsoluteFill><AbsoluteFill style={{ pointerEvents: "none" }}>{floaters}</AbsoluteFill></>;
};

/** A sequence of lines: each is shown until the next one starts. A soft dark scrim keeps them readable over the objects. */
export const Lyrics: React.FC<{ t: number; specs: KSpec[] }> = ({ t, specs }) => {
  const live = specs.some((s) => t >= LINES[s.li].words[0].s - 0.2 && t < (s.until ?? 1e9) + 0.6);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {live ? <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 36% at 50% 30%, rgba(8,7,6,0.6), rgba(8,7,6,0) 75%)" }} /> : null}
      {specs.map((s, k) => <KLine key={s.li} t={t} spec={s} next={specs[k + 1] ? LINES[specs[k + 1].li].words[0].s - 0.1 : undefined} />)}
    </AbsoluteFill>
  );
};

/** Chorus lines (used by both choruses through chorus 1's clock). */
export const CHORUS_SPECS: KSpec[] = [
  { li: 24, rows: [[0, 1, 2], [3]], sizes: [110, 300], beh: { 3: "rise" } },
  { li: 25, rows: [[0, 1, 2], [3]], sizes: [110, 340], beh: { 3: "float" } },
  { li: 26, rows: [[0], [1, 2], [3, 4]], sizes: [220, 100, 170], beh: { 0: "float", 4: "twinkle" } },
  { li: 27, rows: [[0, 1], [2, 3], [4]], sizes: [150, 120, 200], beh: { 1: "dissolve", 3: "stretch", 4: "dissolve" } },
  { li: 28, rows: [[0], [1]], sizes: [300, 150], beh: { 0: "stamp", 1: "shatter" } },
  { li: 29, rows: [[0], [1]], sizes: [300, 130], beh: { 0: "stamp", 1: "shatter" } },
  { li: 30, rows: [[0, 1], [2, 3, 4]], sizes: [200, 120], beh: { 1: "echo", 4: "dissolve" } },
  { li: 31, rows: [[0, 1, 2, 3], [4, 5]], sizes: [110, 240], beh: { 3: "float", 5: "rise" } },
  { li: 32, rows: [[0, 1, 2, 3, 4], [5, 6, 7]], sizes: [100, 220], beh: { 6: "stretch" } },
  { li: 33, rows: [[0, 1, 2], [3]], sizes: [120, 300], beh: { 2: "stretch", 3: "rise" } },
  { li: 34, rows: [[0, 1, 2], [3]], sizes: [110, 340], beh: { 3: "float" }, until: 92.2 },
];
