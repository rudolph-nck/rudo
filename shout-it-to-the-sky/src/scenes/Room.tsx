import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, H, W } from "../theme";
import { kickEnv } from "../data";
import { clamp01, cubicOut, expoOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { F } from "../utils/fonts";

/** Fluorescent tube state: dead, then a stutter of strikes, then on (with mains hum flutter). */
export const tubeLevel = (t: number, on: number) => {
  if (t < on - 1.25) return 0;
  if (t >= on) return 0.93 + 0.07 * noise1(t * 40, 5);
  // deterministic strike pattern in the 1.25 s before `on`
  const k = Math.floor((t - (on - 1.25)) * 30);
  const pattern = [0, 0, 1, 0.2, 0, 0, 0, 0.6, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 1, 1, 0.4, 0, 0, 0, 0.8, 1, 0.7, 0, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  return pattern[Math.min(pattern.length - 1, k)];
};

type Crack = { d: string; len: number; w: number; delay: number };
const makeCracks = (ox: number, oy: number, seed: number): Crack[] => {
  const r = rng(seed);
  const out: Crack[] = [];
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number, delay: number) => {
    let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
    let L = 0;
    const steps = Math.floor(len / 14);
    for (let i = 0; i < steps; i++) {
      ang += (r() - 0.5) * 0.9;
      const s = 10 + r() * 10;
      x += Math.cos(ang) * s;
      y += Math.sin(ang) * s;
      L += s;
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      if (depth < 3 && r() < 0.09) grow(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), len * (0.35 + r() * 0.3), w * 0.6, depth + 1, delay + (L / len) * 0.18);
    }
    out.push({ d, len: L, w, delay });
  };
  const arms = 9;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + r() * 0.5;
    grow(ox, oy, a, 260 + r() * 380, 4.2, 0, r() * 0.04);
  }
  return out;
};

/**
 * RUDO's concrete room: the cleaned Static & Silence cover used as a 2.5D plate, a fluorescent
 * tube, volumetric dust in its light, and (from the 808 drop) a glowing crack in the wall.
 */
export const Room: React.FC<{
  t: number;
  tubeOn: number;
  crackAt?: number;
  zoom?: number;
  panY?: number;
  dim?: number;
  blur?: number;
  warm?: number;
}> = ({ t, tubeOn, crackAt, zoom = 1, panY = 0, dim = 0, blur = 0, warm = 0 }) => {
  const level = tubeLevel(t, tubeOn);
  const S = H * zoom;
  const left = (W - S) / 2 + noise1(t * 0.13, 2) * 14 - 7;
  const top = (H - S) / 2 + panY + noise1(t * 0.11, 4) * 10 - 5;
  const bright = 0.04 + level * 0.96;
  const cracks = useMemo(() => makeCracks(S * 0.5, S * 0.29, 17), [S]);
  const crackP = crackAt === undefined ? 0 : clamp01((t - crackAt) / 0.32);
  const crackGlow = crackAt === undefined || t < crackAt ? 0 : 0.55 + 0.45 * Math.min(1, kickEnv(t, 0.2)) + 0.6 * Math.exp(-(t - crackAt) / 0.35);

  const motes = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 2 + r() * 5, v: 0.004 + r() * 0.012, ph: r() * 10, a: 0.25 + r() * 0.6 }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      <div style={{ position: "absolute", left, top, width: S, height: S, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
        <Img src={staticFile("images/room.png")} style={{ width: S, height: S, filter: `brightness(${bright * (1 - dim)}) contrast(1.06) saturate(${0.9 + warm * 0.4})` }} />
        {crackP > 0 ? (
          <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <defs>
              <filter id="crackglow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={9} />
              </filter>
            </defs>
            {cracks.map((c, i) => {
              const p = expoOut(clamp01((crackP * 1.1 - c.delay) / 0.9));
              const dash = c.len * (1 - p);
              return (
                <g key={i}>
                  <path d={c.d} stroke={`rgba(255,170,70,${0.55 * crackGlow})`} strokeWidth={c.w * 5} fill="none" filter="url(#crackglow)" strokeDasharray={c.len} strokeDashoffset={dash} strokeLinecap="round" />
                  <path d={c.d} stroke="#0a0806" strokeWidth={c.w * 1.7} fill="none" strokeDasharray={c.len} strokeDashoffset={dash} strokeLinejoin="round" />
                  <path d={c.d} stroke={`rgba(255,226,160,${Math.min(1, crackGlow)})`} strokeWidth={c.w * 0.55} fill="none" strokeDasharray={c.len} strokeDashoffset={dash} />
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>

      {/* tube fixture + its light cone */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 230,
          top: 96,
          width: 460,
          height: 12,
          borderRadius: 6,
          background: `rgba(${mix(60, 245, level)},${mix(60, 250, level)},${mix(60, 255, level)},1)`,
          boxShadow: level > 0.1 ? `0 0 ${30 * level}px ${8 * level}px rgba(220,235,255,${0.55 * level}), 0 0 ${140 * level}px ${40 * level}px rgba(200,220,255,${0.22 * level})` : undefined,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 48% 42% at 50% 6%, rgba(215,228,245,${0.16 * level}) 0%, rgba(215,228,245,0) 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "screen", filter: "blur(38px)" }}>
        <defs>
          <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`rgba(225,235,250,${0.11 * level})`} />
            <stop offset="1" stopColor="rgba(225,235,250,0)" />
          </linearGradient>
        </defs>
        <polygon points={`${W / 2 - 230},104 ${W / 2 + 230},104 ${W / 2 + 560},1500 ${W / 2 - 560},1500`} fill="url(#cone)" />
      </svg>

      {/* dust in the beam */}
      {level > 0.05
        ? motes.map((m, i) => {
            const y = ((m.y + t * m.v * 3 + 1) % 1) * 1500 + 110;
            const x = m.x * W + Math.sin(t * 0.4 + m.ph) * 26;
            const inCone = 1 - Math.min(1, Math.abs(x - W / 2) / (230 + ((y - 104) / 1400) * 330));
            const a = m.a * level * (0.15 + inCone * 0.85) * (0.6 + 0.4 * Math.sin(t * 2 + m.ph));
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: m.s,
                  height: m.s,
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, rgba(235,230,220,${a}), rgba(235,230,220,0))`,
                }}
              />
            );
          })
        : null}

      {/* the drop throws dust off the ceiling */}
      {crackAt !== undefined && t >= crackAt && t < crackAt + 2.5 ? <DustFall t={t - crackAt} /> : null}
    </AbsoluteFill>
  );
};

const DustFall: React.FC<{ t: number }> = ({ t }) => {
  const parts = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 140 }, () => ({ x: r() * W, s: 1.5 + r() * 4, v: 280 + r() * 700, d: r() * 0.4, a: 0.3 + r() * 0.6, sw: r() * 40 }));
  }, []);
  const fade = 1 - clamp01((t - 1.4) / 1.1);
  return (
    <>
      {parts.map((p, i) => {
        const tt = t - p.d;
        if (tt < 0) return null;
        const y = 60 + p.v * tt + 120 * tt * tt;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x + Math.sin(tt * 3 + i) * p.sw,
              top: y,
              width: p.s,
              height: p.s * 2.2,
              borderRadius: 3,
              background: `rgba(225,215,195,${p.a * fade})`,
              filter: "blur(0.6px)",
            }}
          />
        );
      })}
    </>
  );
};

/** Opening title, set like the cover: tall tracked RUDO, wide-tracked subtitle. */
export const TitleCard: React.FC<{ t: number; at: number; out: number }> = ({ t, at, out }) => {
  if (t < at || t > out + 0.5) return null;
  const pin = cubicOut(clamp01((t - at) / 1.6));
  const pout = clamp01((t - out) / 0.32);
  const op = pin * (1 - pout);
  const letters = "RUDO".split("");
  return (
    <AbsoluteFill style={{ opacity: op, transform: `scale(${1 + pout * 0.18 + (1 - pin) * 0.04})` }}>
      <div style={{ position: "absolute", top: 250, left: 0, width: W, display: "flex", justifyContent: "center", gap: 92 }}>
        {letters.map((ch, i) => {
          const li = cubicOut(clamp01((t - at - i * 0.18) / 1.2));
          return (
            <span
              key={i}
              style={{
                fontFamily: F.display,
                fontSize: 250,
                lineHeight: 1,
                backgroundImage: `url(${staticFile("fx/grain-3.png")}), linear-gradient(180deg, #b9a893 0%, ${C.stone} 70%, #5f544a 100%)`,
                backgroundBlendMode: "multiply",
                backgroundSize: "200px 200px, 100% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                opacity: li,
                transform: `translateY(${(1 - li) * 26}px)`,
                filter: `blur(${(1 - li) * 6}px)`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 545,
          width: W,
          textAlign: "center",
          fontFamily: F.cond,
          fontWeight: 500,
          fontSize: 38,
          letterSpacing: "0.52em",
          paddingLeft: "0.52em",
          color: C.stone,
          opacity: cubicOut(clamp01((t - at - 0.9) / 1.2)),
        }}
      >
        SHOUT IT TO THE SKY
      </div>
    </AbsoluteFill>
  );
};

