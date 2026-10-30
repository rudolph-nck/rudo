import React from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { kickEnv, linesOf, sectionById, T } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";
import { Caption, lineOut } from "../v3/LyricType";
import { RoofScene } from "../v3/Rise";
import { makeCam } from "../v3/cam";
import { Drawn, Field, Headline, HotLine, INK, MorphDefs, STONE, gridLayout, multiply } from "./Morph";

/**
 * Post-chorus, metamorphosis cut. The hot line left by the chorus climbs as a step graph;
 * the graph tips back into the floor he came up from and RUDO rises out of it, shining;
 * the rays fold into a clock that multiplies (no time); the clocks square off into a calendar,
 * every day crossed in light; then each day opens into a memory of the climb, one per beat.
 */
type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const CX = W / 2;

/** Step graph (screen px), bottom-left to top-right. */
const STEPS = 9;
const graphPath = (() => {
  const x0 = SAFE.left, x1 = SAFE.right, y0 = H * 0.8, y1 = H * 0.42;
  const sx = (x1 - x0) / STEPS, sy = (y0 - y1) / STEPS;
  let d = `M${x0} ${y0}`;
  for (let i = 0; i < STEPS; i++) d += ` L${x0 + sx * (i + 1)} ${y0 - sy * i} L${x0 + sx * (i + 1)} ${y0 - sy * (i + 1)}`;
  return d;
})();

/** Calendar: 7 × 4 day cells. */
const CELL = 128;
const CAL = gridLayout(28, CELL, 7).map((p) => ({ x: CX + p.x, y: H * 0.56 + p.y }));
const dayOrder = [9, 17, 3, 24, 12, 20, 6, 27, 1, 15, 22, 10, 4, 18, 25, 8, 13, 0, 21, 16, 2, 26, 11, 19, 5, 23, 14, 7];

const Clock: React.FC<{ x: number; y: number; r: number; t: number; speed: number; o?: number }> = ({ x, y, r, t, speed, o = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={o}>
    <circle r={r} fill="rgba(14,14,14,0.9)" stroke="url(#metal)" strokeWidth={Math.max(2, r * 0.06)} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <line key={i} x1={Math.cos(a) * r * 0.8} y1={Math.sin(a) * r * 0.8} x2={Math.cos(a) * r * 0.92} y2={Math.sin(a) * r * 0.92} stroke={INK} strokeWidth={Math.max(1, r * 0.03)} />;
    })}
    <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={INK} strokeWidth={Math.max(2, r * 0.06)} strokeLinecap="round" transform={`rotate(${t * speed * 30})`} />
    <line x1={0} y1={0} x2={0} y2={-r * 0.78} stroke={STONE} strokeWidth={Math.max(1.5, r * 0.035)} strokeLinecap="round" transform={`rotate(${t * speed * 360})`} />
    <circle r={r * 0.06} fill={INK} />
  </g>
);

export const PostChorusM: React.FC<{ t: number; a: Assets | null; id?: string; montage: number[]; renderAt: (src: number) => React.ReactNode }> = ({ t, a, id = "postchorus1", montage, renderAt }) => {
  const sec = sectionById(id);
  const L = linesOf(id);
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 0.6));
  const w = (li: number, wi: number) => L[li].words[Math.min(wi, L[li].words.length - 1)].s;
  const kick = kickEnv(t, 0.12);
  const beats = T.beats.filter((b) => b > sec.start - 0.5 && b < sec.end + 0.5);

  // A. graph climbs out of the chorus' hot line
  const graph = clamp01((t - w(0, 0) + 0.05) / (L[0].end - w(0, 0) + 0.1));
  const graphFill = clamp01((t - w(0, 3)) / 0.35);
  // B. the graph tips back into the floor; RUDO rises out of it
  const tip = cubicIn(clamp01((t - w(1, 0)) / 0.5));
  const rise = cubicOut(clamp01((t - w(1, 0) + 0.1) / 0.9));
  const shine = clamp01((t - w(1, 9)) / 0.15);
  // C. rays fold into a clock; clocks multiply on beats
  const clockIn = cubicOut(clamp01((t - w(2, 0)) / 0.2));
  const clockBeats = beats.filter((b) => b > w(2, 0) + 0.05 && b < L[3].start);
  const cm = multiply(t, clockBeats, [1, 4, 9, 16, 28]);
  // D. calendar: the clocks square into day cells, each day crossed by the hot point
  const cal = cubicOut(clamp01((t - w(3, 0) + 0.05) / 0.25));
  const crossFrom = w(3, 3) - 0.1, crossTo = L[3].end + 0.2;
  const crossed = clamp01((t - crossFrom) / (crossTo - crossFrom)) * 28;
  // E. instrumental: each beat opens one day into a memory
  const mBeats = beats.filter((b) => b >= L[3].end + 0.05 && b < sec.end - 0.3);
  const mi = mBeats.filter((b) => b <= t).length - 1;
  const inMontage = mi >= 0 && t < sec.end - 0.3;
  const mT = inMontage ? t - mBeats[mi] : 0;
  // every 8th beat pulls back to the calendar for a breath
  const pullBack = inMontage && mi % 8 === 7;
  const cellIdx = inMontage ? dayOrder[mi % 28] : 0;
  const open = inMontage && !pullBack ? expoOut(clamp01(mT / 0.2)) : 0;
  const src = inMontage ? montage[mi % montage.length] + mT : 0;
  const end = cubicIn(clamp01((t - sec.end + 0.35) / 0.3));
  const showCal = t >= w(3, 0) - 0.05 && (!inMontage || pullBack || open < 1);

  // camera for RUDO rising out of the floor (RoofScene world)
  const cam = React.useMemo(
    () =>
      makeCam([
        { t: w(1, 0) - 0.1, p: [0.2, -0.6, -2.4], l: [0, 1.6, 0], fov: 46 },
        { t: w(1, 5), p: [0.6, 0.5, -3.2], l: [0, 0.9, 0], fov: 44 },
        { t: L[1].end + 0.3, p: [0.1, 1.15, -3.1], l: [0, 0.75, 0], fov: 40 },
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  const rudoOn = t >= w(1, 0) - 0.1 && t < w(2, 0) + 0.25;
  const rudoO = rise * (1 - clamp01((t - w(2, 0)) / 0.25));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* B. RUDO rising out of the floor, then shining */}
      {a && rudoOn ? (
        <AbsoluteFill style={{ opacity: rudoO }}>
          <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
            <RoofScene t={sectionById(id === "postchorus2" ? "chorus3" : "chorus1").start} a={a} id={id === "postchorus2" ? "chorus3" : "chorus1"} cam={cam(t)} />
          </ThreeCanvas>
        </AbsoluteFill>
      ) : null}
      {shine > 0 && t < w(2, 0) + 0.25 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "screen" }}>
          {Array.from({ length: 24 }, (_, i) => {
            const fold = clamp01((t - w(2, 0) + 0.05) / 0.25);
            const ang = (i / 24) * Math.PI * 2 + t * 0.6;
            const r0 = 160, r1 = mix(mix(260, 1300, shine), 230, fold);
            const cy = H * 0.44;
            return <line key={i} x1={CX + Math.cos(ang) * r0} y1={cy + Math.sin(ang) * r0} x2={CX + Math.cos(ang) * r1} y2={cy + Math.sin(ang) * r1} stroke={i % 2 ? STONE : "#fff4e6"} strokeWidth={i % 2 ? 3 : 6} opacity={0.55 * (1 - fold * 0.5) + kick * 0.2} strokeLinecap="round" />;
          })}
        </svg>
      ) : null}
      {/* A. the climb, drawn by the hot point; B. it tips back into the floor */}
      {graph > 0 && tip < 1 ? (
        <Field tilt={mix(0, 78, tip)} originY={80}>
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {/* grid floor lines appear as it tips */}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1={SAFE.left - 400} x2={SAFE.right + 400} y1={H * 0.8 - i * 60} y2={H * 0.8 - i * 60} stroke={INK} strokeWidth={2} opacity={tip * 0.5} />
            ))}
            <Drawn d={graphPath} p={graph} fill={graphFill} w={7} />
          </svg>
        </Field>
      ) : null}
      {/* C. clocks multiplying */}
      {t >= w(2, 0) - 0.02 && t < w(3, 0) + 0.3 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {gridLayout(cm.cur, mix(560, cm.cur > 9 ? 150 : cm.cur > 4 ? 210 : 300, cm.p), cm.cur === 28 ? 7 : undefined).map((p, i) => {
            const n = cm.cur;
            const big = n === 1 ? mix(30, 230, clockIn) : n === 4 ? 130 : n === 9 ? 92 : n === 16 ? 66 : 56;
            const sq = cubicIn(clamp01((t - w(3, 0) + 0.05) / 0.25));
            return <Clock key={i} x={CX + p.x * (n === 28 ? CELL / 150 : 1)} y={H * 0.56 + p.y} r={big * (1 - sq * 0.4)} t={t + i * 0.37} speed={4 + cm.k * 6} o={1 - sq} />;
          })}
        </svg>
      ) : null}
      {/* D. calendar: 28 days, crossed off in light */}
      {showCal ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: cal * (1 - end) }}>
          {CAL.map((c, i) => {
            const k = dayOrder.indexOf(i);
            const x = clamp01(crossed - k);
            const opened = inMontage && dayOrder.slice(0, (mi % 28) + 1).includes(i);
            return (
              <g key={i}>
                <rect x={c.x - CELL / 2 + 6} y={c.y - CELL / 2 + 6} width={CELL - 12} height={CELL - 12} rx={6} fill={opened ? "rgba(196,182,162,0.18)" : "rgba(16,16,16,0.9)"} stroke={inMontage && i === cellIdx ? "#fff4e6" : INK} strokeWidth={inMontage && i === cellIdx ? 5 : 2.5} />
                <text x={c.x - CELL / 2 + 16} y={c.y - CELL / 2 + 36} fontFamily={F.mono} fontSize={20} fill={STONE}>
                  {String(i + 1).padStart(2, "0")}
                </text>
                {x > 0 ? (
                  <svg x={c.x - CELL / 2} y={c.y - CELL / 2} width={CELL} height={CELL} viewBox="0 0 100 100" overflow="visible">
                    <Drawn d="M22 22 L78 78 M78 22 L22 78" p={x} fill={clamp01((crossed - k - 1) / 2)} w={5} />
                  </svg>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {/* E. a day opens into a memory */}
      {inMontage && !pullBack ? (() => {
        const c = CAL[cellIdx];
        const s = mix(CELL / W, 1, open);
        const x = mix(c.x - CX, 0, open), y = mix(c.y - H / 2, 0, open);
        return (
          <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${s})`, transformOrigin: "50% 50%", overflow: "hidden", borderRadius: mix(30, 0, open), opacity: 1 - end }}>
            {renderAt(src)}
            <AbsoluteFill style={{ background: `rgba(255,248,238,${Math.exp(-mT / 0.06) * 0.35})` }} />
            <div style={{ position: "absolute", left: SAFE.left, bottom: 180, ...mono(26, STONE), opacity: open }}>{`DAY ${String(cellIdx + 1).padStart(2, "0")}`}</div>
          </AbsoluteFill>
        );
      })() : null}
      {/* headlines */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 30%)" }} />
      <Headline line={L[0]} t={t} squashAt={outs[0] - 0.2} y={H * 0.26} maxH={460} color={(x) => (/climb/i.test(x) ? STONE : null)} />
      <Headline line={L[1]} t={t} squashAt={outs[1] - 0.2} y={H * 0.2} maxH={300} color={(x) => (/shin/i.test(x) ? STONE : null)} />
      <Headline line={L[2]} t={t} squashAt={outs[2] - 0.2} y={H * 0.2} maxH={340} color={(x, i) => (i === 0 || i === 4 ? STONE : null)} />
      <Headline line={L[3]} t={t} squashAt={outs[3] - 0.15} y={H * 0.22} maxH={300} color={(x) => (/legacy/i.test(x) ? STONE : null)} />
      {L.map((l, i) => (
        <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />
      ))}
      <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{id === "postchorus2" ? "12 / POST-CHORUS — the whole climb" : "05 / POST-CHORUS — every single day"}</div>
      {/* hand-off: everything squashes to the hot line */}
      <HotLine x0={mix(CX, SAFE.left - 60, end)} x1={mix(CX, SAFE.right + 60, end)} y={H * 0.5} o={end} />
    </AbsoluteFill>
  );
};
