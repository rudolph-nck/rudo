import React from "react";
import { clamp01, mix } from "../utils/ease";
import { hash01 } from "../utils/random";

/**
 * Lines drawn in light. A path is laid down by a travelling hot point: white-hot core, warm
 * glow, wide bloom, and a lens flare at the head (anamorphic streak + sparks). The same path
 * runs in reverse to erase (`erase` 0..1 unwrites from the head back).
 */
export const LineDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      <filter id="glowS" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      <filter id="glowM" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
      <filter id="glowL" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
      <radialGradient id="headCore">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="0.18" stopColor="#fffaf2" stopOpacity="0.95" />
        <stop offset="0.45" stopColor="#ffe6c4" stopOpacity="0.35" />
        <stop offset="1" stopColor="#ffd2a0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="streak">
        <stop offset="0" stopColor="#fff6ea" stopOpacity="0.9" />
        <stop offset="0.35" stopColor="#ffe9d0" stopOpacity="0.25" />
        <stop offset="1" stopColor="#ffd9b0" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);

/** Point at fraction u along a path (via a hidden measuring path in the DOM). */
let meas: SVGPathElement | null = null;
const cache = new Map<string, { len: number; pts: { x: number; y: number }[] }>();
export const pathInfo = (d: string) => {
  let c = cache.get(d);
  if (!c) {
    if (!meas) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      meas = document.createElementNS("http://www.w3.org/2000/svg", "path");
      svg.appendChild(meas);
      svg.setAttribute("style", "position:absolute;width:0;height:0");
      document.body.appendChild(svg);
    }
    meas.setAttribute("d", d);
    const len = meas.getTotalLength();
    const pts = Array.from({ length: 801 }, (_, i) => {
      const q = meas!.getPointAtLength((i / 800) * len);
      return { x: q.x, y: q.y };
    });
    c = { len, pts };
    cache.set(d, c);
  }
  return c;
};
export const at = (d: string, u: number) => pathInfo(d).pts[Math.round(clamp01(u) * 800)];

/** The hot point itself: core, halo, horizontal anamorphic streak, a few sparks thrown off. */
export const HotPoint: React.FC<{ x: number; y: number; r?: number; o?: number; seed?: number; t?: number; sparks?: number }> = ({
  x, y, r = 14, o = 1, seed = 0, t = 0, sparks = 6,
}) => {
  if (o <= 0.01) return null;
  const flick = 0.9 + 0.1 * Math.sin(t * 53 + seed);
  return (
    <g opacity={o} style={{ mixBlendMode: "screen" }}>
      <ellipse cx={x} cy={y} rx={r * 16} ry={r * 0.9} fill="url(#streak)" opacity={0.55 * flick} />
      <circle cx={x} cy={y} r={r * 6} fill="url(#headCore)" opacity={0.45} />
      <circle cx={x} cy={y} r={r * 2.2 * flick} fill="url(#headCore)" />
      <circle cx={x} cy={y} r={r * 0.45} fill="#ffffff" />
      {Array.from({ length: sparks }, (_, i) => {
        const life = (t * 2.2 + hash01(seed * 7 + i)) % 1;
        const a = hash01(seed * 13 + i * 3.1) * Math.PI * 2;
        const dist = r * (1.5 + life * 9 * (0.6 + hash01(i + seed)));
        const sx = x + Math.cos(a) * dist, sy = y + Math.sin(a) * dist + life * life * r * 6;
        return <circle key={i} cx={sx} cy={sy} r={Math.max(0.4, r * 0.16 * (1 - life))} fill="#fff3e2" opacity={(1 - life) * 0.9} />;
      })}
    </g>
  );
};

/**
 * A path drawn in light. draw 0..1 lays it down from the start; erase 0..1 removes it from the
 * end back toward the start (the hot point runs backwards). cool 0..1: white-hot → settled
 * warm-white line.
 */
export const LightPath: React.FC<{
  d: string; draw?: number; erase?: number; w?: number; cool?: number; head?: boolean; t?: number; seed?: number; color?: string;
}> = ({ d, draw = 1, erase = 0, w = 3, cool = 1, head = true, t = 0, seed = 0, color = "#f3efe8" }) => {
  const end = draw * (1 - erase);
  if (end <= 0.0005) return null;
  const hot = draw < 1 || (erase > 0 && erase < 1);
  const heat = hot ? 1 : 1 - cool;
  const p = at(d, end);
  const dash = { pathLength: 1, strokeDasharray: `${end} 2`, strokeDashoffset: 0 };
  return (
    <g>
      <path d={d} {...dash} stroke="#ffcf9a" strokeWidth={w * 9} fill="none" filter="url(#glowL)" opacity={0.18 + 0.25 * heat} strokeLinecap="round" />
      <path d={d} {...dash} stroke="#ffe7cc" strokeWidth={w * 3.2} fill="none" filter="url(#glowM)" opacity={0.35 + 0.35 * heat} strokeLinecap="round" />
      <path d={d} {...dash} stroke={mix(0, 1, heat) > 0.5 ? "#ffffff" : color} strokeWidth={w * (1 + heat * 0.3)} fill="none" filter="url(#glowS)" opacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} {...dash} stroke="#ffffff" strokeWidth={w * 0.42} fill="none" opacity={0.95} strokeLinecap="round" strokeLinejoin="round" />
      {head && hot ? <HotPoint x={p.x} y={p.y} r={w * 3.2} t={t} seed={seed} /> : null}
    </g>
  );
};
