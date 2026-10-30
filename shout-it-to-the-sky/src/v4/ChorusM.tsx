import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { kickEnv, linesOf, sectionById, T } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicInOut, cubicOut, expoOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { Caption, lineOut } from "../v3/LyricType";
import { RoofScene } from "../v3/Rise";
import { Drawn, Headline, HotLine, INK, MorphDefs, STONE } from "./Morph";

/**
 * Chorus, metamorphosis cut. The point of light left by the pre-chorus bursts into a skyline;
 * scars multiply into stars; RUDO on the ledge; a grinder throws sparks on the kicks; the legacy
 * builds into a tower that rounds into the world; the world shrinks to a point and the stars
 * stream past as we go out into the universe.
 */
type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const CX = W / 2;
const HORIZON = H * 0.64;

const Obj: React.FC<{ x: number; y: number; size: number; rot?: number; o?: number; children: React.ReactNode }> = ({ x, y, size, rot = 0, o = 1, children }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", transform: `rotate(${rot}deg)`, opacity: o }}>
    {children}
  </svg>
);

/** Skyline blocks across the frame (screen px). */
const BLOCKS = (() => {
  const r = rng(91);
  const out: { x0: number; x1: number; h: number }[] = [];
  let x = -40;
  while (x < W + 40) {
    const w = 40 + r() * 90, h = 60 + r() * (x > 380 && x < 700 ? 340 : 200);
    out.push({ x0: x, x1: x + w, h });
    x += w + 8 + r() * 20;
  }
  return out;
})();
const skyY = (x: number) => HORIZON - (BLOCKS.find((b) => x >= b.x0 && x <= b.x1)?.h ?? 0);
/** Heartbeat trace: flat with a QRS spike every 270px. */
const ekgY = (x: number) => {
  const u = ((((x + 60) % 270) + 270) % 270) / 270;
  if (u > 0.3 && u < 0.38) return HORIZON - Math.sin(((u - 0.3) / 0.08) * Math.PI) * 26;
  if (u > 0.44 && u < 0.47) return HORIZON + ((u - 0.44) / 0.03) * 34;
  if (u > 0.47 && u < 0.52) return HORIZON + 34 - ((u - 0.47) / 0.05) * 330;
  if (u > 0.52 && u < 0.56) return HORIZON - 296 + ((u - 0.52) / 0.04) * 360;
  if (u > 0.56 && u < 0.59) return HORIZON + 64 - ((u - 0.56) / 0.03) * 64;
  if (u > 0.68 && u < 0.8) return HORIZON - Math.sin(((u - 0.68) / 0.12) * Math.PI) * 44;
  return HORIZON;
};
const TRACE_X = Array.from({ length: 361 }, (_, i) => -40 + (i / 360) * (W + 80));

/** "I'MA SHOUT / IT TO THE / SKY!" — slot for each word of the first line once it has flown up. */
const flareSlots = (words: string[]) => {
  const rows = [[0, 1], [2, 3, 4], [5]];
  const fs = [170, 150, 400];
  const ys = [H * 0.15, H * 0.235, H * 0.36];
  const slots: { x: number; y: number; fs: number }[] = [];
  rows.forEach((row, ri) => {
    const ws = row.map((k) => (words[k] ?? "").length * fs[ri] * 0.42 + fs[ri] * 0.25);
    let x = CX - ws.reduce((a, b) => a + b, 0) / 2;
    row.forEach((k, j) => {
      slots[k] = { x: x + ws[j] / 2, y: ys[ri], fs: fs[ri] };
      x += ws[j];
    });
  });
  return slots;
};

/** RUDO as a constellation: letter strokes in a 1 × 1.4 box. */
const GLYPHS: number[][][] = [
  [[0, 1.4, 0, 0, 0.7, 0, 0.9, 0.2, 0.9, 0.5, 0.7, 0.7, 0, 0.7], [0.4, 0.7, 0.9, 1.4]],
  [[0, 0, 0, 1.1, 0.25, 1.4, 0.65, 1.4, 0.9, 1.1, 0.9, 0]],
  [[0, 0, 0, 1.4, 0.55, 1.4, 0.9, 1.0, 0.9, 0.4, 0.55, 0, 0, 0]],
  [[0.3, 0, 0.7, 0, 1.0, 0.35, 1.0, 1.05, 0.7, 1.4, 0.3, 1.4, 0, 1.05, 0, 0.35, 0.3, 0]],
];
const CONST = (() => {
  const u = 150, gap = 1.4, x0 = CX - ((GLYPHS.length - 1) * gap + 1) * u * 0.5, y0 = H * 0.3;
  const pts: { x: number; y: number }[] = [];
  let d = "";
  GLYPHS.forEach((g, gi) =>
    g.forEach((st) => {
      for (let i = 0; i < st.length; i += 2) {
        const x = x0 + (gi * gap + st[i]) * u, y = y0 + st[i + 1] * u;
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
        pts.push({ x, y });
      }
    }),
  );
  return { d, pts };
})();

const Sparks: React.FC<{ t: number; kicks: number[]; x: number; y: number }> = ({ t, kicks, x, y }) => (
  <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
    {kicks.flatMap((k, ki) => {
      const a = t - k;
      if (a < 0 || a > 0.9) return [];
      const r = rng(ki * 31 + 7);
      return Array.from({ length: 46 }, (_, i) => {
        const ang = Math.PI * (1.05 + r() * 0.5), v = 700 + r() * 1300, life = 0.3 + r() * 0.5;
        if (a > life) return null;
        const k2 = a / life;
        const px = x + Math.cos(ang) * v * a, py = y + Math.sin(ang) * v * a + 1600 * a * a;
        const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v + 3200 * a;
        return <line key={`${ki}-${i}`} x1={px - vx * 0.022} y1={py - vy * 0.022} x2={px} y2={py} stroke={`rgba(255,246,232,${1 - k2})`} strokeWidth={2.6 * (1 - k2 * 0.5)} strokeLinecap="round" />;
      });
    })}
  </svg>
);

/** Arc path of length len, curvature theta (0 = straight, 2pi = closed ring), top-centred at (cx, y0). */
const arcPath = (cx: number, y0: number, len: number, theta: number) => {
  const th = Math.max(0.02, Math.min(Math.PI * 2 - 0.002, theta));
  const r = len / th;
  const cy = y0 + r;
  const a0 = -Math.PI / 2 - th / 2, a1 = -Math.PI / 2 + th / 2;
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  return { d: `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${th > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`, r, cy };
};

/**
 * "Still grinding! Still grinding!" as the grinder itself: each STILL pans in; each GRINDING
 * bends from a straight word into a ring and spins, and every new word spins it faster. The two
 * rings sit one inside the other like a cutting disc; sparks fly off the rim on the kicks.
 */
const GrindLyric: React.FC<{ t: number; line: { words: { w: string; s: number; e: number }[] }; end: number; kicks: number[]; slab?: boolean; disc?: number }> = ({ t, line, end, kicks, slab, disc = 0.85 }) => {
  const ws = line.words;
  const grinds = ws.map((w, i) => ({ w, i })).filter(({ w }) => /grind/i.test(w.w));
  const stills = ws.map((w, i) => ({ w, i })).filter(({ w }) => /still/i.test(w.w));
  const C = { x: CX, y: H * 0.52 };
  const radii = [175, 300];
  const fs = 120;
  const g0 = grinds[0]?.w.s ?? end;
  const g1 = grinds[1]?.w.s ?? end;
  // spin: slow after the first ring, fast after the second, fastest into the exit
  const spin = (x: number) => Math.max(0, x);
  const ang = 140 * spin(t - g0) ** 2 + 520 * spin(t - g1) ** 2 + 260 * spin(t - g1);
  const out = cubicIn(clamp01((t - end + 0.22) / 0.2));
  const kick = kickEnv(t, 0.1);
  return (
    <AbsoluteFill
      style={
        slab
          ? { transform: `translateY(${(HORIZON - 40 - C.y) * out}px) scaleY(${mix(1, 0.03, out)})`, transformOrigin: `${C.x}px ${C.y}px` }
          : { opacity: 1 - out, transform: `scale(${mix(1, 0.2, out)})`, transformOrigin: `${C.x}px ${C.y}px` }
      }
    >
      {/* the disc behind the rings, drawn as the second ring closes */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <circle cx={C.x} cy={C.y} r={radii[1] + 70} fill={`rgba(18,18,18,${disc})`} stroke="url(#metal)" strokeWidth={8} opacity={clamp01((t - g1 - 0.2) / 0.2)} />
        <circle cx={C.x} cy={C.y} r={36} fill="url(#metal)" stroke={INK} strokeWidth={3} opacity={clamp01((t - g0 - 0.25) / 0.2)} />
        {grinds.map(({ w }, gi) => {
          const dt = t - w.s;
          if (dt < -0.15) return null;
          const R = radii[gi] ?? radii[0];
          // pan in from the right, then curl
          const pan = expoOut(clamp01((dt + 0.15) / 0.22));
          const curl = cubicOut(clamp01((dt - 0.08) / 0.38));
          const wordLen = fs * 0.4 * 9;
          const len = mix(wordLen, Math.PI * 2 * R, curl);
          const y0 = mix(C.y - 40, C.y - R, curl);
          const arc = arcPath(C.x, y0, len, curl * Math.PI * 2);
          const id = `grind-${gi}-${Math.round(w.s * 100)}`;
          const rot = curl >= 1 ? ang * (gi === 0 ? 1 : -0.8) : 0;
          const text = curl > 0.85 ? "GRINDING · GRINDING · GRINDING · " : "GRINDING!";
          const shift = (1 - pan) * 900;
          return (
            <g key={gi} transform={`translate(${shift} 0) rotate(${rot} ${C.x} ${arc.cy})`}>
              <defs>
                <path id={id} d={arc.d} />
              </defs>
              <text fontFamily="Bebas Neue" fontSize={gi === 0 ? fs : fs * 1.05} fill={gi === 0 ? INK : STONE} textLength={len * 0.995} lengthAdjust="spacingAndGlyphs" style={{ filter: curl >= 1 ? "none" : "drop-shadow(0 10px 30px rgba(0,0,0,0.8))" }}>
                <textPath href={`#${id}`}>{text}</textPath>
              </text>
            </g>
          );
        })}
        {/* motion-blur rings once they're moving fast */}
        {[0, 1].map((gi) => {
          const g = grinds[gi];
          if (!g) return null;
          const v = clamp01((t - g.w.s - 0.5) / 0.6) * (gi === 0 ? 0.6 : 1);
          return v > 0 ? <circle key={gi} cx={C.x} cy={C.y} r={radii[gi] + 28} fill="none" stroke={`rgba(239,237,233,${0.12 * v + kick * 0.05})`} strokeWidth={70} /> : null;
        })}
      </svg>
      {/* STILL pans across, left of the disc */}
      {stills.map(({ w }, si) => {
        const dt = t - w.s;
        if (dt < -0.1 || dt > 0.9) return null;
        const p = expoOut(clamp01((dt + 0.1) / 0.25));
        const leave = cubicIn(clamp01((dt - 0.45) / 0.4));
        return (
          <div key={si} style={{ position: "absolute", left: mix(W, SAFE.left, p) - leave * 900, top: H * 0.2 + si * 10, fontFamily: F.display, fontSize: 260, lineHeight: 1, color: INK, transform: "scaleY(1.4)", transformOrigin: "0 0" }}>
            STILL
          </div>
        );
      })}
      {t > g0 + 0.4 ? <Sparks t={t} kicks={[...kicks.filter((k) => k > g0), ...Array.from({ length: 14 }, (_, i) => g0 + 0.45 + i * 0.18)]} x={C.x - (radii[1] + 60) * 0.7} y={C.y + (radii[1] + 60) * 0.7} /> : null}
    </AbsoluteFill>
  );
};

export const ChorusM: React.FC<{ t: number; a: Assets | null; id?: string; bare?: boolean }> = ({ t, a, id = "chorus1", bare }) => {
  const sec = sectionById(id);
  const L = linesOf(id);
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.4));
  const w = (li: number, wi: number) => L[li].words[Math.min(wi, L[li].words.length - 1)].s;
  const kick = kickEnv(t, 0.12);
  const kicks = T.kicks.filter((k) => k.v > 0.25 && k.t > sec.start && k.t < sec.end + 0.5).map((k) => k.t);
  const HEAD = { x: CX, y: H * 0.36 }; // RUDO's head on screen at the open

  // A. SHOUT: a blast out of him; each word launches like a flare; SKY bursts into sparks
  const shoutT = w(0, 1);
  const flareWords = L[0].words.map((x) => x.w.toUpperCase());
  const slots = flareSlots(flareWords);
  const burstT = L[0].end - 0.12;
  const burstP = expoOut(clamp01((t - burstT) / 1.3));
  const flash = t >= shoutT ? Math.exp(-(t - shoutT) / 0.1) * 0.5 : 0;
  // B. sparks land as scars (on "scar"), cool to stars (on "night"); the stars draw RUDO
  const scarAt = w(1, 0) - 0.1, nightAt = w(1, 3);
  const cool = clamp01((t - nightAt - 0.05) / 0.3);
  const conP = clamp01((t - nightAt) / 0.9);
  const conOut = clamp01((t - L[2].start - 0.1) / 0.3);
  const stars = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 260 }, (_, i) => ({ x: r() * W, y: r() * HORIZON * 0.92, a: r() * Math.PI, l: 40 + r() * 120, tw: r(), ox: (r() - 0.5) * 2, oy: (r() - 0.5) * 2, k: i % 6 }));
  }, []);
  // C. came up from the floor: a heartbeat traced across the city line; on ALIVE it rises into the skyline
  const traceP = clamp01((t - w(2, 0)) / (w(2, 5) - w(2, 0) + 0.05));
  const toCity = cubicOut(clamp01((t - w(2, 5)) / 0.45));
  const cityFill = clamp01((t - w(2, 5) - 0.35) / 0.4);
  const traceOut = clamp01((t - w(3, 0) + 0.15) / 0.3);
  // D/H. grinding
  const grindOn = (t >= w(3, 0) - 0.2 && t < w(4, 0)) || t >= w(7, 0) - 0.2;
  // E. the disc lands as a slab; legacy floors stack on it, then round into the world
  const tower = clamp01((t - w(4, 0)) / 1.0);
  const toWorld = cubicOut(clamp01((t - w(5, 0)) / 0.4));
  const globeDraw = clamp01((t - w(5, 0)) / 0.5);
  // G. universe: the world shrinks to a point, stars stream outward ... then swirl into a galaxy = the last grinder
  const shrink = cubicIn(clamp01((t - w(6, 0)) / 0.5));
  const warp = clamp01((t - w(6, 4)) / 1.2);
  const swirl = cubicInOut(clamp01((t - w(7, 0) + 0.5) / 0.8));
  const C2 = { x: CX, y: H * 0.52 };
  const gal = 0.6 * Math.max(0, t - w(7, 0) + 0.5) ** 2 + 0.8 * Math.max(0, t - w(7, 3));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* heartbeat → skyline */}
      {traceP > 0 && traceOut < 1 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - traceOut, transform: `translateY(${-(HORIZON - H * 0.47)}px)` }}>
          {(() => {
            const n = Math.max(2, Math.round(traceP * (TRACE_X.length - 1)) + 1);
            const pts = TRACE_X.slice(0, n).map((x) => [x, mix(ekgY(x), skyY(x), toCity)]);
            const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
            const head = pts[pts.length - 1];
            return (
              <>
                {cityFill > 0 ? <path d={`${d} L${head[0]} ${HORIZON + 400} L${pts[0][0]} ${HORIZON + 400} Z`} fill="rgba(10,10,10,0.75)" opacity={cityFill} /> : null}
                <path d={d} fill="none" stroke="rgba(255,236,210,0.45)" strokeWidth={14} filter="url(#soft)" />
                <path d={d} fill="none" stroke={cityFill > 0.1 ? "url(#metal)" : "#fff4e6"} strokeWidth={mix(4, 6, cityFill) + kick * 2} strokeLinejoin="round" />
                {traceP < 1 ? <circle cx={head[0]} cy={head[1]} r={30} fill="url(#hot)" /> : null}
              </>
            );
          })()}
        </svg>
      ) : null}
      {/* RUDO on the roof, in contour lines; the camera whips up to the sky and back */}
      {a && t < w(6, 4) + 0.6 ? (
        <AbsoluteFill style={{ opacity: (1 - warp) * (grindOn ? 0.35 : 1) }}>
          <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
            <RoofScene t={t} a={a} id={id} />
          </ThreeCanvas>
        </AbsoluteFill>
      ) : null}
      {/* the blast out of him on SHOUT */}
      {t >= shoutT && t < shoutT + 1 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {[0, 0.12, 0.24].map((d, i) => {
            const p = clamp01((t - shoutT - d) / 0.7);
            return p > 0 && p < 1 ? <circle key={i} cx={HEAD.x} cy={HEAD.y} r={mix(60, 1500, cubicOut(p))} fill="none" stroke="#fff4e6" strokeWidth={mix(26, 2, p)} opacity={1 - p} /> : null;
          })}
        </svg>
      ) : null}
      {/* stars: sparks → scars → stars → warp streaks → galaxy */}
      {t >= burstT ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {stars.map((s, i) => {
            const sl = slots[s.k] ?? slots[0];
            const ox = sl.x + s.ox * sl.fs * 0.9, oy = sl.y + s.oy * sl.fs * 0.35;
            const px = mix(ox, s.x, burstP), py = mix(oy, s.y, burstP);
            const tw = 0.6 + 0.4 * Math.sin(t * 3 + s.tw * 9);
            if (t < scarAt) {
              // flying sparks with streaks back toward where they came from
              const k = Math.max(0.02, (1 - burstP) * 0.35);
              return <line key={i} x1={px - (s.x - ox) * k} y1={py - (s.y - oy) * k} x2={px} y2={py} stroke="#fff4e6" strokeWidth={3} strokeLinecap="round" opacity={0.75 + 0.25 * tw} />;
            }
            if (cool < 1) {
              const sp = cubicOut(clamp01((t - scarAt - (i % 20) * 0.03) / 0.2));
              const len = s.l * sp * (1 - cool);
              const dx = (Math.cos(s.a) * len) / 2, dy = (Math.sin(s.a) * len) / 2;
              return <line key={i} x1={s.x - dx} y1={s.y - dy} x2={s.x + dx} y2={s.y + dy} stroke={cool > 0.3 ? INK : "#fff4e6"} strokeWidth={mix(4.5, 3, cool)} strokeLinecap="round" />;
            }
            // warp streaks out of the centre
            const vx = s.x - CX, vy = s.y - H * 0.4;
            const wf = 1 + warp * 3.5;
            let sx = CX + vx * wf, sy = H * 0.4 + vy * wf;
            if (swirl > 0) {
              const rr = 70 + (i / 260) * 470;
              const ang = (i % 2) * Math.PI + rr / 95 + gal + (s.tw - 0.5) * 0.5;
              sx = mix(sx, C2.x + Math.cos(ang) * rr, swirl);
              sy = mix(sy, C2.y + Math.sin(ang) * rr * 0.92, swirl);
              return <circle key={i} cx={sx} cy={sy} r={mix(3, 2.6, swirl) + kick} fill={i % 7 ? INK : STONE} opacity={tw} />;
            }
            if (warp > 0) {
              const tail = warp * 0.4;
              return <line key={i} x1={CX + vx * (wf - tail * wf)} y1={H * 0.4 + vy * (wf - tail * wf)} x2={sx} y2={sy} stroke={INK} strokeWidth={2 + warp * 2} strokeLinecap="round" opacity={tw} />;
            }
            return <circle key={i} cx={s.x} cy={s.y} r={2.4 + kick * 1.2} fill={INK} opacity={tw * (t > L[2].start ? 0.6 : 1)} />;
          })}
        </svg>
      ) : null}
      {/* the stars join up into RUDO */}
      {conP > 0 && conOut < 1 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - conOut }}>
          <Drawn d={CONST.d} p={conP} fill={0} w={3.5} />
          {CONST.pts.map((q, i) => (
            <circle key={i} cx={q.x} cy={q.y} r={7 + kick * 3} fill="#fff4e6" opacity={clamp01(conP * 1.4 - (i / CONST.pts.length) * 0.9)} />
          ))}
        </svg>
      ) : null}
      {/* flares: each word of the first line launches up from him and holds in the sky */}
      {!bare && t >= L[0].start - 0.15 && t < burstT + 0.1 ? (
        <AbsoluteFill>
          {L[0].words.map((x, k) => {
            const dt = t - x.s + 0.12;
            if (dt < 0) return null;
            const sl = slots[k];
            const p = expoOut(clamp01(dt / 0.42));
            const y = mix(H * 0.82, sl.y, p);
            const gone = clamp01((t - burstT) / 0.08);
            const sky = k === L[0].words.length - 1;
            return (
              <React.Fragment key={k}>
                <div style={{ position: "absolute", left: sl.x - 4, top: y + sl.fs * 0.35, width: 8, height: (1 - p) * 700 + 30, borderRadius: 4, background: "linear-gradient(180deg, rgba(255,244,230,0.95), rgba(255,244,230,0))", opacity: (1 - p * 0.85) * (1 - gone), filter: "blur(1px)" }} />
                <div style={{ position: "absolute", left: sl.x - 600, width: 1200, top: y - sl.fs * 0.5, textAlign: "center", fontFamily: F.display, fontSize: sl.fs, lineHeight: 1, color: p < 0.9 ? "#fff4e6" : sky ? STONE : INK, transform: `scaleY(${mix(1.7, 1.25, p)})`, opacity: 1 - gone, textShadow: p < 1 ? "0 0 40px rgba(255,236,210,0.9)" : "0 10px 40px rgba(0,0,0,0.8)" }}>
                  {flareWords[k]}
                </div>
              </React.Fragment>
            );
          })}
        </AbsoluteFill>
      ) : null}
      {/* grinding: the lyric curls into a spinning disc */}
      {!bare && t >= w(3, 0) - 0.05 && t < w(4, 0) ? <GrindLyric t={t} line={L[3]} end={w(4, 0)} kicks={kicks} slab /> : null}
      {!bare && t >= w(7, 0) - 0.05 ? <GrindLyric t={t} line={L[7]} end={sec.end} kicks={kicks} disc={0.55} /> : null}
      {/* legacy: the slab, floors stacking in light, rounding into the world */}
      {tower > 0 && t < w(6, 1) ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <rect x={CX - 375} y={HORIZON - 46} width={750} height={10} rx={4} fill="url(#metal)" opacity={1 - clamp01((t - w(4, 0)) / 0.5)} />
          {Array.from({ length: 12 }, (_, i) => {
            const p = clamp01(tower * 12 - i);
            if (p <= 0) return null;
            const fw = mix(300, 120, i / 11), fy = HORIZON - 40 - i * 52;
            const ang = (i / 12) * Math.PI;
            const gy = H * 0.42 + Math.cos(ang) * 260;
            const gw = Math.sin(ang) * 520 + 20;
            const x = mix(CX - fw / 2, CX - gw / 2, toWorld), y = mix(fy, gy, toWorld), ww = mix(fw, gw, toWorld);
            return <rect key={i} x={x} y={y} width={ww * p} height={mix(40, 4, toWorld)} rx={mix(4, 2, toWorld)} fill="none" stroke={p < 1 ? "#fff4e6" : INK} strokeWidth={3} opacity={1 - shrink} />;
          })}
          {globeDraw > 0 ? (
            <g transform={`translate(${CX} ${H * 0.42}) scale(${mix(1, 0.01, shrink)})`}>
              <svg x={-280} y={-280} width={560} height={560} viewBox="0 0 200 200" overflow="visible">
                <Drawn d="M100 8 A92 92 0 1 1 99.9 8" p={globeDraw} fill={clamp01((t - w(5, 3)) / 0.3)} w={3} />
                {[0.3, 0.6, 0.85].map((k, i) => (
                  <ellipse key={i} cx={100} cy={100} rx={92 * k * Math.abs(Math.cos(t * 1.4 + i))} ry={92} fill="none" stroke={INK} strokeWidth={1.5} opacity={globeDraw} />
                ))}
                {[-0.5, 0, 0.5].map((k, i) => (
                  <ellipse key={`l${i}`} cx={100} cy={100 + k * 92} rx={92 * Math.sqrt(1 - k * k)} ry={8} fill="none" stroke={INK} strokeWidth={1.5} opacity={globeDraw} />
                ))}
              </svg>
            </g>
          ) : null}
        </svg>
      ) : null}
      {/* headlines */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 26%)" }} />
      {!bare ? (
        <>
          <Headline line={L[2]} t={t} squashAt={outs[2] - 0.25} y={H * 0.22} maxH={380} color={(x) => (/alive/i.test(x) ? STONE : null)} />
          <Headline line={L[6]} t={t} squashAt={outs[6] - 0.2} y={H * 0.25} maxH={460} color={(x) => (/universe/i.test(x) ? STONE : null)} />
          {L.map((l, i) => (
            <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />
          ))}
          <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{id === "chorus2" ? "08 / CHORUS — sunrise" : id === "chorus3" ? "11 / FINAL CHORUS" : "04 / CHORUS — the roof"}</div>
        </>
      ) : null}
      <HotLine x0={SAFE.left - 60} x1={SAFE.right + 60} y={H * 0.27} o={clamp01((t - sec.end + 0.15) / 0.08)} />
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,248,238,${flash})` }} /> : null}
    </AbsoluteFill>
  );
};
