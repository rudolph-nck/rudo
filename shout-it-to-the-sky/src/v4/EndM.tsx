import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { T, kickEnv, linesOf, sectionById } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { Caption, lineOut } from "../v3/LyricType";
import { RoofScene } from "../v3/Rise";
import { makeCam } from "../v3/cam";
import { GrindLyric } from "./ChorusM";
import { Drawn, HOT, Headline, HotLine, INK, MorphDefs, STONE } from "./Morph";

type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const CX = W / 2;
const Obj: React.FC<{ x: number; y: number; size: number; rot?: number; o?: number; children: React.ReactNode }> = ({ x, y, size, rot = 0, o = 1, children }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", transform: `rotate(${rot}deg)`, opacity: o }}>
    {children}
  </svg>
);

// =============================================================================================
/**
 * Bridge, metamorphosis cut: half-time and close. Worn sneakers drawn in light, the holes burn
 * through; the headset and the 2 AM clock of the night shift; dues drop as coins; a seed crawls
 * along the ground (keep going, it's slow); it drops in and a tree grows in light, branch by
 * branch, and blooms into the stars of the last chorus.
 */
const BR = linesOf("bridge");
const BR_END = linesOf("chorus3")[0].words[0].s - 0.05;
const bw = (li: number, wi: number) => BR[li].words[Math.min(wi, BR[li].words.length - 1)].s;
const SHOE = "M14 150 L22 104 Q52 100 74 72 L104 74 Q112 98 148 108 Q188 116 188 150 Z M14 150 H188 M22 164 H182 M60 92 l16 10 M70 84 l16 10";
const HEADSET = "M40 120 C40 40 160 40 160 120 M28 112 h24 v52 h-24 z M148 112 h24 v52 h-24 z M40 164 C60 192 110 188 128 176";
const GROUND = H * 0.8;

type Br = { x0: number; y0: number; x1: number; y1: number; d: number };
const TREE: Br[] = (() => {
  const r = rng(77);
  const out: Br[] = [];
  const grow = (x: number, y: number, ang: number, len: number, d: number) => {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    out.push({ x0: x, y0: y, x1, y1, d });
    if (d >= 7) return;
    const n = d < 2 ? 2 : r() < 0.3 ? 3 : 2;
    for (let i = 0; i < n; i++) grow(x1, y1, ang + (i - (n - 1) / 2) * (0.5 + r() * 0.3) + (r() - 0.5) * 0.2, len * (0.7 + r() * 0.12), d + 1);
  };
  grow(CX, GROUND, -Math.PI / 2, 300, 0);
  return out;
})();

export const BridgeM: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const outs = BR.map((l, i) => lineOut(l, BR[i + 1], 1.6));
  const kick = kickEnv(t, 0.2);
  // A. sneakers
  const shoeDraw = clamp01((t - bw(0, 0) + 0.3) / 0.8);
  const shoeOut = cubicIn(clamp01((t - bw(1, 0) + 0.1) / 0.25));
  const holes = [[70, 150], [120, 150], [160, 140], [40, 130]];
  // B. night shift
  const setDraw = clamp01((t - bw(1, 0) + 0.05) / 0.45);
  const setOut = cubicIn(clamp01((t - bw(2, 0) + 0.1) / 0.25));
  const coins = T.beats.filter((b) => b >= bw(1, 7) - 0.1 && b < bw(2, 0)).concat([bw(1, 7), bw(1, 9), bw(1, 9) + 0.15]).sort();
  // C. the seed crawls; D. tree
  const crawl = clamp01((t - bw(2, 0)) / (bw(3, 0) - bw(2, 0)));
  const seedX = mix(SAFE.left, CX, cubicOut(crawl) * 0.4 + crawl * 0.6);
  const g0 = bw(3, 0) + 0.15, dt = (bw(3, 7) + 0.6 - g0) / 8;
  const bloom = clamp01((t - bw(3, 7)) / 0.6);
  const sway = Math.sin(t * 1.4) * 0.6;
  const end = clamp01((t - BR_END + 0.25) / 0.25);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* sneakers, two of them, holes burning through */}
      {shoeOut < 1 ? (
        <>
          {[-1, 1].map((s) => (
            <Obj key={s} x={CX + s * 210} y={H * 0.56} size={400} rot={s > 0 ? 0 : 0} o={1 - shoeOut}>
              <g transform={s < 0 ? "translate(200 0) scale(-1 1)" : undefined}>
                <Drawn d={SHOE} p={shoeDraw} fill={clamp01((t - bw(0, 5)) / 0.3)} w={4} />
                {holes.map(([hx, hy], i) => {
                  const b = clamp01((t - bw(0, 8) - i * 0.07) / 0.2);
                  return b > 0 ? <circle key={i} cx={hx} cy={hy - 6} r={mix(1, 9, b)} fill="#000" stroke={b < 1 ? HOT : STONE} strokeWidth={3} /> : null;
                })}
              </g>
            </Obj>
          ))}
          {t > bw(0, 2) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.72, textAlign: "center", ...mono(28, "rgba(239,237,233,0.55)"), opacity: 1 - shoeOut }}>BACK ROW · SIZE 9 · 2 YEARS OLD</div> : null}
        </>
      ) : null}
      {/* the night shift */}
      {t > bw(1, 0) - 0.1 && setOut < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - setOut }}>
          <Obj x={CX} y={H * 0.48} size={460}>
            <Drawn d={HEADSET} p={setDraw} fill={clamp01((t - bw(1, 3)) / 0.3)} w={5} />
          </Obj>
          {t > bw(1, 5) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.32, textAlign: "center", ...mono(60, STONE) }}>02:00 AM</div> : null}
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            {coins.map((c, i) => {
              const p = cubicIn(clamp01((t - c) / 0.3));
              if (t < c) return null;
              const y = mix(H * 0.3, H * 0.76 - i * 22, p);
              return <ellipse key={i} cx={CX + 330} cy={y} rx={46} ry={14} fill="url(#metal)" stroke={INK} strokeWidth={2} />;
            })}
          </svg>
          {t > bw(1, 9) ? <div style={{ position: "absolute", left: CX + 250, width: 160, top: H * 0.79, textAlign: "center", ...mono(24, STONE) }}>DUES</div> : null}
        </AbsoluteFill>
      ) : null}
      {/* the ground, the seed, the tree */}
      {t > bw(2, 0) - 0.15 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - end }}>
          <line x1={-20} x2={W + 20} y1={GROUND} y2={GROUND} stroke={INK} strokeWidth={3} opacity={clamp01((t - bw(2, 0) + 0.15) / 0.3)} />
          {t < g0 ? (
            <>
              <line x1={SAFE.left} x2={seedX} y1={GROUND + 30} y2={GROUND + 30} stroke={STONE} strokeWidth={2} strokeDasharray="6 10" />
              <circle cx={seedX} cy={GROUND - 12 + (t > bw(3, 0) ? clamp01((t - bw(3, 0)) / 0.15) * 24 : 0)} r={12} fill={HOT} />
              <circle cx={seedX} cy={GROUND - 12} r={40} fill="url(#hot)" />
            </>
          ) : null}
          {TREE.map((b, i) => {
            const p = cubicOut(clamp01((t - g0 - b.d * dt) / dt));
            if (p <= 0) return null;
            const sw = (b.d / 7) * sway * 18;
            const x1 = mix(b.x0, b.x1, p) + sw, y1 = mix(b.y0, b.y1, p);
            return <line key={i} x1={b.x0 + (b.d ? ((b.d - 1) / 7) * sway * 18 : 0)} y1={b.y0} x2={x1} y2={y1} stroke={p < 1 ? HOT : INK} strokeWidth={Math.max(1.5, 16 - b.d * 2.2)} strokeLinecap="round" />;
          })}
          {bloom > 0
            ? TREE.filter((b) => b.d === 7).map((b, i) => (
                <circle key={i} cx={b.x1 + sway * 18} cy={b.y1} r={(3 + kick * 2) * bloom + (i % 5 === 0 ? 3 : 0)} fill={i % 4 ? INK : STONE} opacity={bloom} />
              ))
            : null}
          {bloom > 0 ? <text x={CX} y={GROUND + 70} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={28} fill={STONE} opacity={bloom}>{`YEAR ${Math.min(12, 1 + Math.floor(bloom * 11))}`}</text> : null}
        </svg>
      ) : null}
      {end > 0 ? <AbsoluteFill style={{ background: `rgba(255,248,238,${end * 0.9})` }} /> : null}
      {bare ? null : (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 22%)" }} />
          <Headline line={BR[2]} t={t} squashAt={outs[2] - 0.2} y={H * 0.24} maxH={300} color={(w) => (/slow/i.test(w) ? STONE : null)} />
          <Headline line={BR[3]} t={t} squashAt={BR_END - 0.5} y={H * 0.24} maxH={300} color={(w) => (/grow/i.test(w) ? STONE : null)} />
          {BR.map((l, i) => (
            <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />
          ))}
          <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>10 / BRIDGE — the slow ones grow</div>
        </>
      )}
    </AbsoluteFill>
  );
};

// =============================================================================================
/**
 * Outro: the line curls into the grinder one last time; STILL GRINDING; the disc becomes a halo
 * round RUDO and the camera pulls all the way back off the tower; the title card; to a point; out.
 */
const OUT = linesOf("outro")[0];
const OSEC = sectionById("outro");
const GRIND_END = OUT.end + 1.7;
const PULL0 = GRIND_END - 0.25;
const CARD0 = 233.5;
const FIN = T.duration;
const outCam = makeCam([
  { t: PULL0, p: [0, 1.2, -2.6], l: [0, 0.75, 0], fov: 40 },
  { t: PULL0 + 2.0, p: [1.4, 2.2, -6.5], l: [0, 0.5, 0], fov: 40 },
  { t: CARD0 + 1.5, p: [6, 9, -24], l: [0, -6, 0], fov: 42 },
  { t: FIN, p: [9, 16, -40], l: [0, -12, 0], fov: 42 },
]);

export const OutroM: React.FC<{ t: number; a: Assets | null; bare?: boolean }> = ({ t, a, bare }) => {
  const kicks = useMemo(() => T.kicks.filter((k) => k.v > 0.25 && k.t > OSEC.start && k.t < GRIND_END).map((k) => k.t), []);
  const lineIn = 1 - clamp01((t - OSEC.start) / 0.6);
  const ringIn = clamp01((t - OSEC.start - 0.3) / 0.8);
  const pull = clamp01((t - PULL0) / 0.5);
  const halo = clamp01((t - PULL0) / 0.4) * (1 - clamp01((t - CARD0) / 1.5));
  const card = (k: number, d = 0.25) => expoOut(clamp01((t - CARD0 - k) / d));
  const sq = cubicIn(clamp01((t - (FIN - 1.9)) / 0.3));
  const dot = clamp01((t - (FIN - 1.55)) / 0.6);
  const out = clamp01((t - (FIN - 0.6)) / 0.5);
  const roofT = sectionById("chorus3").start + 4 + (t - PULL0) * 0.3;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* the world he built, seen from further and further away */}
      {a && t >= PULL0 ? (
        <AbsoluteFill style={{ opacity: pull * (1 - sq) }}>
          <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
            <RoofScene t={roofT} a={a} id="chorus3" cam={outCam(t)} tower />
          </ThreeCanvas>
        </AbsoluteFill>
      ) : null}
      {/* the line from the post-chorus curls into a ring */}
      {t < OUT.start + 0.1 ? (
        <>
          <HotLine x0={mix(CX - 6, SAFE.left - 60, lineIn)} x1={mix(CX + 6, SAFE.right + 60, lineIn)} y={mix(H * 0.52, H * 0.5, lineIn)} o={Math.max(lineIn, 0.001)} />
          {ringIn > 0 ? (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
              <circle cx={CX} cy={H * 0.52} r={175} fill="none" stroke={HOT} strokeWidth={6} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ringIn} transform={`rotate(${-90 + t * 200} ${CX} ${H * 0.52})`} />
            </svg>
          ) : null}
        </>
      ) : null}
      {!bare && t >= OUT.start - 0.05 && t < GRIND_END ? <GrindLyric t={t} line={OUT} end={GRIND_END} kicks={kicks} /> : null}
      {/* halo around him as we pull back */}
      {halo > 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "screen" }}>
          <circle cx={CX} cy={H * 0.42} r={mix(60, 420, cubicOut(halo))} fill="none" stroke={HOT} strokeWidth={4} opacity={halo * 0.8} />
        </svg>
      ) : null}
      {/* title card */}
      {t >= CARD0 ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 38%, rgba(0,0,0,0) 55%)", opacity: card(0, 0.6) * (1 - sq) }} /> : null}
      {!bare && t >= CARD0 ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * 0.17, textAlign: "center", transform: `scaleY(${mix(1, 0.01, sq)})`, transformOrigin: `50% ${-H * 0.04}px` }}>
          <div style={{ fontFamily: F.display, fontSize: 330, lineHeight: 0.9, color: INK, transform: `scaleY(${mix(2.4, 1.5, card(0))})`, opacity: card(0), textShadow: "0 20px 60px rgba(0,0,0,0.9)" }}>RUDO</div>
          <div style={{ marginTop: 120, fontFamily: F.display, fontSize: 104, lineHeight: 1, color: STONE, transform: `scaleY(${mix(2, 1.3, card(0.85))})`, opacity: card(0.85) }}>SHOUT IT TO THE SKY</div>
          <div style={{ marginTop: 40, ...mono(30, "rgba(239,237,233,0.7)"), opacity: card(1.7, 0.5) }}>from STATIC &amp; SILENCE</div>
        </div>
      ) : null}
      {/* everything to a line, the line to a point, the point out */}
      {sq > 0 ? <HotLine x0={mix(SAFE.left - 60, CX - 4, dot)} x1={mix(SAFE.right + 60, CX + 4, dot)} y={H * 0.13} o={clamp01(sq * 3) * (1 - out)} /> : null}
      {dot > 0.9 ? <div style={{ position: "absolute", left: CX - 60, top: H * 0.13 - 60, width: 120, height: 120, borderRadius: 60, background: "radial-gradient(circle, rgba(255,244,230,0.9), rgba(255,244,230,0) 60%)", opacity: 1 - out }} /> : null}
      {!bare && t < GRIND_END ? <Caption line={OUT} t={t} out={GRIND_END} top={210} /> : null}
      {!bare && t < CARD0 ? <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>13 / OUTRO — still grinding</div> : null}
    </AbsoluteFill>
  );
};

