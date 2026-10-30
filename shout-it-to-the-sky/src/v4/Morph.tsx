import React from "react";
import { AbsoluteFill } from "remotion";
import { Line } from "../data";
import { W, H, SAFE } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";

/**
 * Metamorphosis toolkit (after the reference reel): objects are drawn by a travelling hot point,
 * fill to solid metal, multiply on the beat, tilt into a field, and hand off to the next thing.
 */
export const INK = "#efede9";
export const STONE = "#c4b6a2";
export const GHOST = "rgba(239,237,233,0.16)";
export const HOT = "#fff4e6";

// ---------------------------------------------------------------------------------------------
// path geometry helpers (run in the browser)
let measurer: SVGPathElement | null = null;
const pathCache = new Map<string, { len: number; at: (u: number) => { x: number; y: number } }>();
export const pathInfo = (d: string) => {
  let p = pathCache.get(d);
  if (!p) {
    if (!measurer) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      measurer = document.createElementNS("http://www.w3.org/2000/svg", "path");
      svg.appendChild(measurer);
      svg.setAttribute("style", "position:absolute;width:0;height:0");
      document.body.appendChild(svg);
    }
    measurer.setAttribute("d", d);
    const len = measurer.getTotalLength();
    const samples = Array.from({ length: 401 }, (_, i) => {
      const q = measurer!.getPointAtLength((i / 400) * len);
      return { x: q.x, y: q.y };
    });
    p = { len, at: (u: number) => samples[Math.round(clamp01(u) * 400)] };
    pathCache.set(d, p);
  }
  return p;
};

/** Gradients/filters used by every drawn object. Mount once per frame. */
export const MorphDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f2ee" />
        <stop offset="0.35" stopColor="#a9a6a0" />
        <stop offset="0.6" stopColor="#5e5c58" />
        <stop offset="1" stopColor="#cfccc6" />
      </linearGradient>
      <radialGradient id="hot">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="0.25" stopColor="#fff1dd" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
      </radialGradient>
      <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  </svg>
);

/**
 * A shape (SVG path, in its own viewBox units) drawn by a hot point, then filled to metal.
 * p: 0..1 draw progress; fill: 0..1 metal fill; w: stroke width in viewBox units.
 */
export const Drawn: React.FC<{ d: string; p: number; fill: number; w?: number; cool?: number }> = ({ d, p, fill, w = 6, cool = 1 }) => {
  if (p <= 0) return null;
  const info = pathInfo(d);
  const head = info.at(p);
  const hot = p < 1 ? 1 : Math.max(0, 1 - cool * 2);
  return (
    <g>
      {/* glow of the fresh line */}
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={`rgba(255,236,210,${0.5 * (1 - fill)})`} strokeWidth={w * 3} fill="none" filter="url(#soft)" strokeLinecap="round" />
      {/* the line, cooling from white-hot to metal */}
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={fill > 0.02 ? "url(#metal)" : "#f6efe4"} strokeWidth={mix(w * 0.45, w * 1.35, fill)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {fill > 0.02 ? <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke="rgba(255,255,255,0.75)" strokeWidth={w * 0.18} fill="none" transform={`translate(0 ${-w * 0.3})`} strokeLinecap="round" /> : null}
      {hot > 0.01 ? <circle cx={head.x} cy={head.y} r={w * 5} fill="url(#hot)" opacity={hot} /> : null}
    </g>
  );
};

// ---------------------------------------------------------------------------------------------
/** Layout for n copies: 1, 2, 4, then a grid; rows alternate rotation like the reference. */
export const gridLayout = (n: number, cell: number, cols?: number) => {
  const c = cols ?? Math.ceil(Math.sqrt(n));
  const r = Math.ceil(n / c);
  return Array.from({ length: n }, (_, i) => ({ x: ((i % c) - (c - 1) / 2) * cell, y: (Math.floor(i / c) - (r - 1) / 2) * cell }));
};

/** Multiplication over beats: returns count and a 0..1 step progress. */
export const multiply = (t: number, beats: number[], counts: number[]) => {
  let k = beats.filter((b) => b <= t).length;
  k = Math.min(k, counts.length - 1);
  const prev = counts[Math.max(0, k - 1)], cur = counts[k];
  const p = k === 0 ? 1 : cubicOut(clamp01((t - beats[k - 1]) / 0.18));
  return { k, prev, cur, p };
};

// ---------------------------------------------------------------------------------------------
/**
 * Tall condensed headline (the reference's "NOW THERE'S NOWHERE LEFT TO GO"): slams in stretched,
 * words light as sung, then squashes down into a single hot line.
 */
export const Headline: React.FC<{
  line: Line;
  t: number;
  squashAt: number;
  y?: number;
  color?: (word: string, i: number) => string | null;
  maxH?: number;
}> = ({ line, t, squashAt, y = H * 0.42, color, maxH = 420 }) => {
  if (t < line.start - 0.02 || t > squashAt + 0.35) return null;
  const words = line.words.map((w) => w.w.toUpperCase());
  const text = words.join(" ");
  const maxW = SAFE.right - SAFE.left;
  const fsize = Math.min(maxH / 0.9 / 1.9, maxW / (text.length * 0.37));
  const enter = expoOut(clamp01((t - line.start) / 0.22));
  const sq = cubicIn(clamp01((t - squashAt) / 0.25));
  const sy = 1.9 * mix(1.6, 1, enter) * mix(1, 0.008, sq);
  const lineGlow = clamp01((t - squashAt - 0.15) / 0.1);
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: y - fsize * 0.5, width: maxW, height: fsize, display: "flex", justifyContent: "center", alignItems: "center", transform: `scaleY(${sy}) scaleX(${mix(1, 1.25, sq)})`, transformOrigin: "50% 50%" }}>
      <div style={{ fontFamily: F.display, fontSize: fsize, lineHeight: 0.9, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
        {line.words.map((w, i) => {
          const lit = t >= w.s;
          const now = lit && t < (line.words[i + 1]?.s ?? line.end);
          const c = color?.(w.w, i);
          return (
            <span key={i} style={{ color: !lit ? GHOST : c ?? (now ? STONE : INK), textShadow: lineGlow > 0 ? `0 0 40px rgba(255,240,220,${lineGlow})` : "0 10px 40px rgba(0,0,0,0.8)" }}>
              {words[i]}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** A hot horizontal line that travels/turns into the next object (the squashed headline). */
export const HotLine: React.FC<{ x0: number; x1: number; y: number; o: number }> = ({ x0, x1, y, o }) =>
  o <= 0 ? null : (
    <div style={{ position: "absolute", left: x0, top: y - 3, width: x1 - x0, height: 6, borderRadius: 3, background: HOT, opacity: o, boxShadow: "0 0 24px 6px rgba(255,236,210,0.55), 0 0 90px 20px rgba(255,236,210,0.2)" }} />
  );

/** Perspective "field" wrapper: tilts its children down into a floor. */
export const Field: React.FC<{ tilt: number; z?: number; children: React.ReactNode; originY?: number }> = ({ tilt, z = 0, children, originY = 60 }) => (
  <AbsoluteFill style={{ perspective: 1100, perspectiveOrigin: `50% ${originY - 25}%` }}>
    <AbsoluteFill style={{ transform: `translateZ(${z}px) rotateX(${tilt}deg)`, transformOrigin: `50% ${originY}%`, transformStyle: "preserve-3d" }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

export { W, H };
