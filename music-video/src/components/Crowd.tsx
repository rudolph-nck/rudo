import React, { useMemo } from "react";
import chops from "../../data/chops.json";
import { C } from "../theme";
import { clamp01 } from "../utils/ease";
import { rng } from "../utils/random";
import { beatIndex, BEATS, FPS } from "../utils/time";

type Person = { x: number; r: number; phase: number; arms: 0 | 1 | 2; armAng: number; phone: boolean; jump: number };
type Row = { base: number; r: number; count: number; tone: string; rim: number; parallax: number; seed: number };

const ROWS: Row[] = [
  { base: 830, r: 20, count: 30, tone: "#101722", rim: 0.75, parallax: 0.2, seed: 10 },
  { base: 900, r: 30, count: 22, tone: "#0b1119", rim: 0.65, parallax: 0.35, seed: 11 },
  { base: 1000, r: 44, count: 15, tone: "#070a0f", rim: 0.55, parallax: 0.6, seed: 12 },
  { base: 1130, r: 66, count: 10, tone: "#030405", rim: 0.45, parallax: 1.0, seed: 13 },
];

const lastChop = (t: number) => {
  let c = -99;
  for (const x of chops.yeah) if (x <= t) c = x;
  return c;
};

/**
 * A concert crowd in silhouette, three parallax rows, backlit by the stage.
 * Everyone moves on the beat grid (smooth jumps, swaying arms); each chopped
 * "yeah" (data/chops.json) throws more hands up.
 */
export const Crowd: React.FC<{ abs: number; driftX?: number }> = ({ abs, driftX = 0 }) => {
  const t = abs / FPS;
  const rows = useMemo(
    () =>
      ROWS.map((row) => {
        const r = rng(row.seed);
        const span = 2300;
        return Array.from({ length: row.count }, (_, i): Person => ({
          x: -190 + (i + 0.5) * (span / row.count) + (r() - 0.5) * 60,
          r: row.r * (0.85 + r() * 0.3),
          phase: (r() - 0.5) * 0.18,
          arms: (r() < 0.35 ? 2 : r() < 0.55 ? 1 : 0) as 0 | 1 | 2,
          armAng: 8 + r() * 18,
          phone: r() < 0.22,
          jump: 0.6 + r() * 0.8,
        }));
      }),
    [],
  );
  const bi = Math.max(0, beatIndex(abs));
  const b0 = BEATS[bi] ?? 0;
  const b1 = BEATS[bi + 1] ?? b0 + 0.557;
  const hype = Math.exp(-Math.max(0, t - lastChop(t)) * 2.2); // hands go up on each "yeah"

  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id="crowdRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.blue} stopOpacity="0.9" />
          <stop offset="0.35" stopColor={C.blue} stopOpacity="0" />
        </linearGradient>
      </defs>
      {rows.map((people, ri) => {
        const row = ROWS[ri];
        return (
          <g key={ri} transform={`translate(${driftX * row.parallax} 0)`}>
            {people.map((p, i) => {
              // smooth per-person jump: phase-shifted beat cosine
              const ph = clamp01((t + p.phase - b0) / (b1 - b0));
              const bob = (1 - Math.cos(ph * Math.PI * 2)) / 2;
              const y = row.base - bob * p.r * 0.5 * p.jump;
              const shoulderW = p.r * 3.1;
              const armsUp = p.arms + (hype > 0.35 && p.arms < 2 && (i + ri) % 2 === 0 ? 1 : 0);
              const sway = Math.sin(t * 3.4 + i) * 10;
              const arm = (side: -1 | 1) => {
                const ang = (side * (p.armAng + (1 - hype) * 6) + sway) * (Math.PI / 180);
                const sx = p.x + side * shoulderW * 0.32;
                const sy = y - p.r * 0.4;
                const len = p.r * 3.0 * (0.85 + 0.15 * hype);
                const ex = sx + Math.sin(ang) * len;
                const ey = sy - Math.cos(ang) * len;
                return (
                  <g key={side}>
                    <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={row.tone} strokeWidth={p.r * 0.45} strokeLinecap="round" />
                    <circle cx={ex} cy={ey} r={p.r * 0.3} fill={row.tone} />
                    {p.phone && side === 1 && (
                      <rect x={ex - p.r * 0.16} y={ey - p.r * 0.55} width={p.r * 0.32} height={p.r * 0.5} rx={2} fill="#dff7ff" opacity={0.9} />
                    )}
                  </g>
                );
              };
              return (
                <g key={i}>
                  {armsUp >= 1 && arm(1)}
                  {armsUp >= 2 && arm(-1)}
                  <path
                    d={`M${p.x - shoulderW / 2} ${y + p.r * 3} Q${p.x - shoulderW / 2} ${y - p.r * 0.2} ${p.x} ${y - p.r * 0.25} Q${p.x + shoulderW / 2} ${y - p.r * 0.2} ${p.x + shoulderW / 2} ${y + p.r * 3} Z`}
                    fill={row.tone}
                  />
                  <circle cx={p.x} cy={y - p.r * 1.05} r={p.r} fill={row.tone} />
                  <circle cx={p.x} cy={y - p.r * 1.05} r={p.r} fill="url(#crowdRim)" opacity={row.rim} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

/** Strobe amount for the "yeah" chops (0..1), for light flashes. */
export const chopStrobe = (abs: number) => {
  const t = abs / FPS;
  return Math.exp(-Math.max(0, t - lastChop(t)) * 9);
};
