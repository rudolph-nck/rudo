import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { kickEnv, linesOf, sectionById, T } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, mix } from "../utils/ease";
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

/** Skyline path across the frame in screen px (drawn left to right). */
const skylinePath = (() => {
  const r = rng(91);
  let d = `M-40 ${HORIZON}`;
  let x = -40;
  while (x < W + 40) {
    const w = 40 + r() * 90, h = 60 + r() * (x > 380 && x < 700 ? 340 : 200);
    d += ` L${x.toFixed(0)} ${(HORIZON - h).toFixed(0)} L${(x + w).toFixed(0)} ${(HORIZON - h).toFixed(0)} L${(x + w).toFixed(0)} ${HORIZON}`;
    x += w + 8 + r() * 20;
    d += ` L${x.toFixed(0)} ${HORIZON}`;
  }
  return d;
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

export const ChorusM: React.FC<{ t: number; a: Assets | null; id?: string; bare?: boolean }> = ({ t, a, id = "chorus1", bare }) => {
  const sec = sectionById(id);
  const L = linesOf(id);
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.4));
  const w = (li: number, wi: number) => L[li].words[Math.min(wi, L[li].words.length - 1)].s;
  const kick = kickEnv(t, 0.12);
  const kicks = T.kicks.filter((k) => k.v > 0.25 && k.t > sec.start && k.t < sec.end + 0.5).map((k) => k.t);

  // A. the point bursts up, the skyline is drawn in light
  const burst = clamp01((t - w(0, 0)) / 0.12);
  const sky = clamp01((t - w(0, 1)) / 0.75);
  const skyFill = clamp01((t - w(0, 5)) / 0.4);
  const flash = Math.exp(-Math.max(0, t - w(0, 0)) / 0.12) * (t >= w(0, 0) ? 0.9 : 0);
  // B. scars → stars
  const starsN = t < w(1, 1) ? 0 : t < w(1, 2) ? 6 : t < w(1, 3) ? 40 : 260;
  const stars = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * HORIZON * 0.92, a: r() * Math.PI, l: 40 + r() * 120, tw: r() }));
  }, []);
  const starify = (i: number) => clamp01((t - (i < 6 ? w(1, 1) : i < 40 ? w(1, 2) : w(1, 3)) - 0.18) / 0.25);
  // C. RUDO on the ledge
  const roof = clamp01((t - (w(2, 0) - 0.4)) / 0.6);
  // D/H. grinder
  const grindOn = (t >= w(3, 0) - 0.2 && t < w(4, 0)) || t >= w(7, 0) - 0.2;
  // E. legacy tower
  const tower = clamp01((t - w(4, 0)) / 1.0);
  const toWorld = cubicOut(clamp01((t - w(5, 0)) / 0.4));
  const globeDraw = clamp01((t - w(5, 0)) / 0.5);
  // G. universe: the world shrinks to a point, stars stream outward
  const shrink = cubicIn(clamp01((t - w(6, 0)) / 0.5));
  const warp = clamp01((t - w(6, 4)) / 1.2);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* RUDO on the roof, in contour lines */}
      {a && roof > 0 && t < w(6, 4) + 0.6 ? (
        <AbsoluteFill style={{ opacity: roof * (1 - warp) }}>
          <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
            <RoofScene t={t} a={a} id={id} />
          </ThreeCanvas>
        </AbsoluteFill>
      ) : null}
      {/* stars: scars first, then they shrink to points; warp streaks for the universe */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {stars.slice(0, starsN).map((s, i) => {
          const p = starify(i);
          const len = mix(s.l, 0, p);
          const dx = Math.cos(s.a) * len / 2, dy = Math.sin(s.a) * len / 2;
          // warp: radial streaks out of the centre
          const vx = s.x - CX, vy = s.y - H * 0.4;
          const wf = 1 + warp * 3.5;
          const sx = CX + vx * wf, sy = H * 0.4 + vy * wf;
          const tail = warp * 0.4;
          const tw = 0.6 + 0.4 * Math.sin(t * 3 + s.tw * 9);
          return p < 1 ? (
            <line key={i} x1={s.x - dx} y1={s.y - dy} x2={s.x + dx} y2={s.y + dy} stroke={p < 0.2 ? "#fff4e6" : INK} strokeWidth={mix(4, 3, p)} strokeLinecap="round" />
          ) : warp > 0 ? (
            <line key={i} x1={CX + vx * (wf - tail * wf)} y1={H * 0.4 + vy * (wf - tail * wf)} x2={sx} y2={sy} stroke={INK} strokeWidth={2 + warp * 2} strokeLinecap="round" opacity={tw} />
          ) : (
            <circle key={i} cx={s.x} cy={s.y} r={2.4 + kick * 1.2} fill={INK} opacity={tw} />
          );
        })}
      </svg>
      {/* skyline drawn in light; it cools to the city behind him */}
      {sky > 0 && t < w(2, 0) + 0.3 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - clamp01((t - w(2, 0)) / 0.3) }}>
          <Drawn d={skylinePath} p={sky} fill={skyFill} w={4} />
        </svg>
      ) : null}
      {/* the burst: the point from the pre-chorus shoots up into the sky */}
      {t < w(0, 1) + 0.2 ? <HotLine x0={CX - 3} x1={CX + 3} y={mix(H * 0.3, H * 0.1, burst)} o={1 - clamp01((t - w(0, 1)) / 0.2)} /> : null}
      {burst > 0 && burst < 1 ? <div style={{ position: "absolute", left: CX - 3, top: H * 0.1, width: 6, height: (HORIZON - H * 0.1) * burst, background: "#fff4e6", boxShadow: "0 0 30px 8px rgba(255,240,220,0.6)" }} /> : null}
      {/* grinder wheel at the ledge + sparks on the kicks */}
      {grindOn ? (
        <>
          <Obj x={CX + 250} y={H * 0.68} size={240} rot={t * 900}>
            <Drawn d="M100 30 A70 70 0 1 1 99.9 30 M100 70 A30 30 0 1 1 99.9 70" p={clamp01((t - w(3, 0) + 0.2) / 0.25)} fill={1} w={6} />
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1={100 + Math.cos((i / 12) * Math.PI * 2) * 40} y1={100 + Math.sin((i / 12) * Math.PI * 2) * 40} x2={100 + Math.cos((i / 12) * Math.PI * 2) * 66} y2={100 + Math.sin((i / 12) * Math.PI * 2) * 66} stroke={INK} strokeWidth={3} />
            ))}
          </Obj>
          <Sparks t={t} kicks={kicks.filter((k) => k > w(3, 0) - 0.3)} x={CX + 140} y={H * 0.7} />
        </>
      ) : null}
      {/* legacy tower: floors stack in light, then round into the world */}
      {tower > 0 && t < w(6, 1) ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const p = clamp01(tower * 12 - i);
            if (p <= 0) return null;
            const fw = mix(300, 120, i / 11), fy = HORIZON - 40 - i * 52;
            const ang = (i / 12) * Math.PI;
            const gx = CX + Math.cos(ang + Math.PI / 2) * 0, gy = H * 0.42 + Math.cos(ang) * 260;
            const gw = Math.sin(ang) * 520 + 20;
            const x = mix(CX - fw / 2, CX - gw / 2, toWorld), y = mix(fy, gy, toWorld), ww = mix(fw, gw, toWorld);
            return <rect key={i} x={x} y={y} width={ww * p} height={mix(40, 4, toWorld)} rx={mix(4, 2, toWorld)} fill="none" stroke={p < 1 ? "#fff4e6" : INK} strokeWidth={3} opacity={1 - shrink} transform={`translate(0 0) scale(${1})`} />;
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
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 34%)" }} />
      {!bare ? (
        <>
          <Headline line={L[0]} t={t} squashAt={outs[0] - 0.25} y={H * 0.27} maxH={520} />
          <Headline line={L[2]} t={t} squashAt={outs[2] - 0.25} y={H * 0.27} maxH={420} color={(x) => (/alive/i.test(x) ? STONE : null)} />
          <Headline line={L[3]} t={t} squashAt={outs[3] - 0.2} y={H * 0.27} maxH={460} />
          <Headline line={L[6]} t={t} squashAt={outs[6] - 0.2} y={H * 0.25} maxH={460} color={(x) => (/universe/i.test(x) ? STONE : null)} />
          <Headline line={L[7]} t={t} squashAt={sec.end - 0.35} y={H * 0.27} maxH={460} />
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

