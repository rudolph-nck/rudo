import React from "react";
import { AbsoluteFill } from "remotion";
import { PlusMark, Segment } from "../components/Brand";
import { monthX, TimelineRuler } from "../components/Timeline";
import { Field, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { Stage3D } from "../three/Stage3D";
import { C, F, glow } from "../theme";
import { Counter, Hero, Mono, Scramble } from "../typography/Type";
import { baseCam, camPath } from "../utils/camera";
import { clamp01, cubicInOut, expoIn, expoInOut, expoOut, mix, quintOut, ramp, sineInOut } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { chapter, useWorld } from "../utils/scenes";
import { beatPulse, energy } from "../utils/time";

const seg = (cx: number, cy: number, ang: number, len: number) => {
  const a = (ang * Math.PI) / 180;
  const dx = (Math.cos(a) * len) / 2,
    dy = (Math.sin(a) * len) / 2;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
};

const CLUSTER = (seed: number, cx: number, cy: number, n: number, spread: number) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2,
      d = Math.pow(r(), 0.7) * spread;
    return { x: cx + Math.cos(a) * d * 1.4, y: cy + Math.sin(a) * d * 0.8, s: 3 + r() * 4, ph: r() * 6 };
  });
};
const TLH = CLUSTER(11, 430, 420, 9, 70);
const ORL = CLUSTER(12, 1490, 420, 26, 95);

const DATA_ROWS = [
  "SYS.A  ▸ SYS.B   ACCOUNTS ........ MIGRATED",
  "SYS.A  ▸ SYS.B   LOANS ........... MIGRATED",
  "SYS.A  ▸ SYS.B   CARDS ........... MIGRATED",
  "SYS.A  ▸ SYS.B   ONLINE BANKING .. LIVE",
  "SYS.A  ▸ SYS.B   MEMBERS ......... ONE",
];

export const VerseWorld: React.FC = () => {
  const { f, L, abs } = useWorld("verse");
  const off = chapter("verse").startFrame;
  const CH = L("changin"),
    TW = L("twoteams"),
    EN = L("envision"),
    SD = L("sides"),
    MR = L("march"),
    LD = L("longdays"),
    GR = L("groove"),
    IM = L("improve");
  const END = chapter("verse").endFrame - off;
  const SHOOT = END - 30;

  // ---------- 3D timeline (JAN → MAR) ----------
  const base = baseCam(40);
  const cam = camPath(
    f,
    [
      [0, { x: monthX(0) + 3200, y: -170, ry: -12, z: base.z * 1.05 }],
      [9, { x: monthX(0) - 380 }, expoOut],
      [TW, { x: monthX(0) + 180 }, sineInOut],
      [MR, { x: monthX(0) + 180 }],
      [MR + 14, { x: monthX(2) - 380, ry: -16 }, expoInOut],
      [LD, { x: monthX(2) - 300 }],
    ],
    base,
    cubicInOut,
  );
  const tlOpacity = Math.max(
    1 - ramp(f, TW, 24) , // timeline recedes when the teams arrive
    ramp(f, MR, 6) * (1 - ramp(f, MR + 26, 14)),
  ) * (f < LD ? 1 : 0);
  const tlDim = f < TW ? 1 : f >= MR ? 1 : 0.18;

  // ---------- two teams → plus ----------
  const headA = mix(-100, 1180, ramp(f, TW, 52, expoOut));
  const headB = mix(-100, 1180, ramp(f, TW + 7, 52, expoOut));
  const toPlus = ramp(f, EN, 30, expoInOut);
  const a = seg(mix((headA - 100) / 2, 960, toPlus), mix(430, 540, toPlus), mix(0, -90, toPlus), mix(headA + 100, 760, toPlus));
  const b = seg(mix((headB - 100) / 2, 960, toPlus), mix(560, 540, toPlus), 0, mix(headB + 100, 1040, toPlus));
  const plusGrow = ramp(f, EN + 28, 14, expoOut);
  const plusGrowV = ramp(f, EN + 32, 14, expoOut);
  const pull = ramp(f, SD, 22, expoInOut);
  const plusScale = mix(1, 0.16, pull);
  const teamsOut = ramp(f, MR - 2, 8);

  // ---------- conversion ----------
  const convIn = ramp(f, MR + 28, 14, expoOut);
  const convFill = ramp(f, MR + 34, LD - MR - 40, cubicInOut);
  const convOut = ramp(f, LD, 18, expoInOut);

  // ---------- dial ----------
  const dialDraw = ramp(f, LD + 2, 20, expoOut);
  const hand = ramp(f, LD + 6, GR - LD - 8, sineInOut) * 720;
  const dialOut = ramp(f, GR, 16, expoInOut);
  const dayLight = 0.5 + 0.5 * Math.cos((hand * Math.PI) / 180);

  // ---------- waveform / improve ----------
  const waveIn = ramp(f, GR + 4, 18, expoOut);
  const settle = ramp(f, IM + 6, 50, expoInOut);
  const shoot = ramp(f, SHOOT, 30, expoIn);
  const pulse = beatPulse(abs, 6);

  const wavePath = (amp: number, freq: number, phase: number, jitter: number, seed: number) => {
    let d = "";
    for (let x = 0; x <= 1920; x += 10) {
      const w = Math.sin((Math.PI * x) / 1920);
      const clean = 540 + amp * w * Math.sin(x * freq - phase);
      const j = (noise1(x / 60 + f * 0.15, seed) - 0.5) * jitter * w;
      const curve = 880 - 640 * Math.pow(x / 1920, 1.8); // the improving curve
      const y = mix(clean + j, curve, settle) - shoot * 900 * Math.pow(x / 1920, 3);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    return d;
  };

  const inPlusScene = f >= TW && f < MR + 10;

  return (
    <AbsoluteFill>
      <Field />
      <ParticleField cam={cam} frame={f + 900} count={220} opacity={0.3} size={1.5} seed={9}
        box={{ x: [-1500, 6000], y: [-1400, 1400], z: [-3000, 600] }} />

      {/* timeline */}
      <AbsoluteFill style={{ opacity: tlOpacity * (f < TW ? 1 : f >= MR ? 1 : tlDim) }}>
        <Stage3D cam={cam}>
          <TimelineRuler active={f >= MR + 10 ? 2 : 0} labelSize={24} />
        </Stage3D>
      </AbsoluteFill>
      {f >= MR - 2 && f < MR + 30 && (
        // month whip — "March came quick"
        <AbsoluteFill style={{ opacity: ramp(f, MR, 4) * (1 - ramp(f, MR + 16, 10)) }}>
          <div style={{ position: "absolute", left: 0, top: 380, width: 1920, height: 2, background: `linear-gradient(90deg, transparent, rgba(${C.blueRGB},0.6), transparent)`, transform: `scaleX(${ramp(f, MR, 14, expoOut)})` }} />
        </AbsoluteFill>
      )}

      {/* CHANGIN' */}
      {f < TW + 10 && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, TW - 6, 14) }}>
          <div style={{ position: "absolute", left: 120, top: 150 }}>
            <Mono text="Q1 · JAN 2026 · 01" t={f - CH} size={15} opacity={0.5} />
          </div>
          <div style={{ position: "absolute", left: 112, top: 210 }}>
            <Scramble text="CHANGIN’" size={250} t={f - CH - 20} lockEvery={5} />
          </div>
        </AbsoluteFill>
      )}

      {/* two teams → the plus → the map */}
      {inPlusScene && (
        <AbsoluteFill style={{ opacity: 1 - teamsOut }}>
          <AbsoluteFill style={{ transform: `scale(${plusScale})`, transformOrigin: "960px 540px" }}>
            <Segment {...a} w={mix(4, 6, toPlus)} color={C.blue} glowAmt={0.7} opacity={1 - plusGrow * 0.7} />
            <Segment {...b} w={mix(3, 6, toPlus)} color={toPlus > 0.5 ? C.blue : C.white} glowAmt={toPlus} opacity={(0.85 + 0.15 * toPlus) * (1 - plusGrow * 0.7)} />
            {/* heads + labels */}
            <div style={{ position: "absolute", left: a.x2 + 18, top: a.y2 - 30, opacity: 1 - toPlus }}>
              <Mono text="01 · ADDITION" t={f - TW - 10} size={20} opacity={0.9} color={C.blue} weight={500} />
            </div>
            <div style={{ position: "absolute", left: b.x2 + 18, top: b.y2 + 10, opacity: 1 - toPlus }}>
              <Mono text="02 · ENVISION" t={f - TW - 18} size={20} opacity={0.8} weight={500} />
            </div>
            {/* the future point */}
            <div style={{ position: "absolute", left: 1560, top: 495, opacity: ramp(f, TW + 28, 20) * (1 - toPlus) }}>
              <div style={{ position: "absolute", left: -6, top: -6, width: 12, height: 12, borderRadius: 6, background: C.white }} />
              <div style={{ position: "absolute", left: -40, top: -40, width: 80, height: 80, borderRadius: 40, border: `1px solid rgba(255,255,255,${0.5 * (1 - ((f - TW) % 40) / 40)})`, transform: `scale(${0.3 + ((f - TW) % 40) / 40})` }} />
              <div style={{ position: "absolute", left: 24, top: -34 }}>
                <Mono text="FUTURE" t={f - TW - 36} size={16} opacity={0.6} />
              </div>
            </div>
            {/* the plus */}
            {plusGrow > 0 && (
              <div style={{ position: "absolute", left: 960, top: 540, transform: "translate(-50%,-50%)" }}>
                <PlusMark size={200} h={plusGrow} v={plusGrowV} glowAmt={1} />
              </div>
            )}
            {/* ENVISION / ADDITION ride the bars */}
            <div style={{ position: "absolute", left: 960 - 150, top: 540 - 16, transform: "translate(-100%,-100%)", opacity: 1 - pull }}>
              <Hero text="ENVISION" size={92} t={f - EN - 4} dur={14} stagger={1.2} />
            </div>
            <div style={{ position: "absolute", left: 960 + 22, top: 1050, transform: "rotate(-90deg)", transformOrigin: "0 0", opacity: 1 - pull }}>
              <Hero text="ADDITION" size={80} t={f - EN - 16} dur={14} stagger={1.2} color={C.blue} />
            </div>
          </AbsoluteFill>

          {/* different sides of the map */}
          {f >= SD - 2 && (
            <AbsoluteFill style={{ opacity: ramp(f, SD + 6, 14) }}>
              {Array.from({ length: 17 }, (_, i) => (
                <div key={`v${i}`} style={{ position: "absolute", left: i * 120, top: 0, width: 1, height: 1080, background: "rgba(255,255,255,0.05)" }} />
              ))}
              {Array.from({ length: 10 }, (_, i) => (
                <div key={`h${i}`} style={{ position: "absolute", left: 0, top: i * 120, width: 1920, height: 1, background: "rgba(255,255,255,0.05)" }} />
              ))}
              <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
                <path d="M430 420 Q960 660 1490 420" fill="none" stroke={C.blue} strokeWidth={2.5}
                  strokeDasharray="1300" strokeDashoffset={1300 * (1 - ramp(f, SD + 8, 20, expoOut))} style={{ filter: glow(0.6) }} />
              </svg>
              {[...TLH, ...ORL].map((p, i) => (
                <div key={i} style={{ position: "absolute", left: p.x - p.s / 2, top: p.y - p.s / 2, width: p.s, height: p.s, borderRadius: p.s,
                  background: C.white, opacity: ramp(f, SD + 6 + (i % 9), 10) * (0.55 + 0.45 * Math.sin(f * 0.1 + p.ph)) }} />
              ))}
              <div style={{ position: "absolute", left: 330, top: 500 }}>
                <Mono text={"TLH\n30.44°N 84.28°W"} t={f - SD - 10} size={15} opacity={0.6} />
              </div>
              <div style={{ position: "absolute", left: 1400, top: 540 }}>
                <Mono text={"ORL\n28.54°N 81.38°W"} t={f - SD - 14} size={15} opacity={0.6} />
              </div>
              {/* one call */}
              {f >= SD + 22 &&
                [0, 8, 16].map((d) => {
                  const t = clamp01((f - SD - 22 - d) / 30);
                  return (
                    <div key={d} style={{ position: "absolute", left: 960, top: 540, width: 1000, height: 1000, marginLeft: -500, marginTop: -500, borderRadius: 500,
                      border: `2px solid rgba(${C.blueRGB},${0.8 * (1 - t)})`, transform: `scale(${quintOut(t)})` }} />
                  );
                })}
              <div style={{ position: "absolute", left: 960, top: 190, transform: "translateX(-50%)" }}>
                <Hero text="ONE CALL" size={150} t={f - SD - 20} dur={12} stagger={1} />
              </div>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      )}

      {/* conversion */}
      {f >= MR + 24 && f < GR && (
        <AbsoluteFill style={{ opacity: convIn }}>
          <div style={{ position: "absolute", left: 150, top: 300, opacity: 1 - convOut }}>
            <Mono text="MAR 2026 · SYSTEMS" t={f - MR - 28} size={16} opacity={0.5} />
            <div style={{ height: 14 }} />
            <Scramble text="CONVERSION" size={132} t={f - MR - 26} family={F.mono} weight={500} tracking={0.02} lockEvery={1.6} />
          </div>
          {/* the progress line */}
          <div style={{ position: "absolute", left: mix(150, 960, convOut), top: 560, width: mix(1620, 0, convOut) * (convOut > 0 ? 1 : convFill), height: 4, background: C.blue, filter: glow(0.8) }} />
          <div style={{ position: "absolute", left: 150, top: 560, width: 1620 * (1 - convOut), height: 4, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ position: "absolute", right: 150, top: 500, opacity: 1 - convOut }}>
            <Counter from={0} to={100} dur={LD - MR - 40} t={f - MR - 34} pad={3} size={40} suffix="%" opacity={0.9} />
          </div>
          <div style={{ position: "absolute", left: 150, top: 610, opacity: 1 - convOut }}>
            {DATA_ROWS.map((r, i) => {
              const done = convFill > (i + 1) / DATA_ROWS.length;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <Mono text={r} t={f - MR - 40 - i * 7} size={17} opacity={done ? 0.75 : 0.3} color={done && i === 4 ? C.blue : C.white} cps={120} />
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* 24h dial — long days, late nights */}
      {f >= LD && f < GR + 20 && (
        <AbsoluteFill style={{ opacity: 1 - dialOut, transform: `scale(${mix(1, 1.8, dialOut)})`, transformOrigin: "960px 540px" }}>
          <LightPool x={960} y={540} r={760} color={`255,${mix(170, 210, dayLight).toFixed(0)},${mix(110, 255, 1 - dayLight).toFixed(0)}`} opacity={0.05 + 0.1 * dayLight} />
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <circle cx={960} cy={540} r={300} fill="none" stroke={C.blue} strokeWidth={4} strokeDasharray={1885} strokeDashoffset={1885 * (1 - dialDraw)}
              transform="rotate(-90 960 540)" style={{ filter: glow(0.7) }} />
            {Array.from({ length: 96 }, (_, i) => {
              const an = (i / 96) * Math.PI * 2 - Math.PI / 2;
              const big = i % 4 === 0;
              const r1 = 322,
                r2 = big ? 350 : 334;
              return (
                <line key={i} x1={960 + Math.cos(an) * r1} y1={540 + Math.sin(an) * r1} x2={960 + Math.cos(an) * r2} y2={540 + Math.sin(an) * r2}
                  stroke={big ? C.white : C.anchor} strokeWidth={big ? 1.5 : 1} opacity={ramp(f, LD + i * 0.15, 8)} />
              );
            })}
            <line x1={960} y1={540} x2={960 + Math.cos(((hand - 90) * Math.PI) / 180) * 270} y2={540 + Math.sin(((hand - 90) * Math.PI) / 180) * 270}
              stroke={C.white} strokeWidth={2} opacity={dialDraw} />
            <circle cx={960} cy={540} r={6} fill={C.white} opacity={dialDraw} />
          </svg>
          {["00", "06", "12", "18"].map((h, i) => {
            const an = (i / 4) * Math.PI * 2 - Math.PI / 2;
            return (
              <div key={h} style={{ position: "absolute", left: 960 + Math.cos(an) * 400, top: 540 + Math.sin(an) * 400, transform: "translate(-50%,-50%)" }}>
                <Mono text={`${h}:00`} t={f - LD - 6} size={16} opacity={0.6} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 960, top: 600, transform: "translateX(-50%)" }}>
            <Counter from={61} to={89} dur={GR - LD - 6} t={f - LD - 4} pad={3} size={18} opacity={0.7} style={{ textAlign: "center" }} />
            <Mono text="DAY" t={999} size={12} opacity={0.4} style={{ textAlign: "center", marginTop: 6 }} />
          </div>
          <div style={{ position: "absolute", left: 1330, top: 200 }}>
            <Hero text={"LONG DAYS.\nLATE NIGHTS."} size={64} t={f - LD - 8} dur={12} stagger={0.8} color={C.white} lineHeight={1.05} />
          </div>
        </AbsoluteFill>
      )}

      {/* the groove → improve */}
      {f >= GR && (
        <AbsoluteFill style={{ transform: `translateY(${shoot * 1100}px)` }}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {[0, 1, 2, 3].map((k) => (
              <path key={k} d={wavePath(55 + k * 18, 0.011 + k * 0.003, f * (0.22 + k * 0.05) + k, 90 * (1 - settle), k + 2)} fill="none" stroke={C.white}
                strokeWidth={1.2} opacity={ramp(f, IM, 14) * 0.45 * (1 - settle * 0.9)} />
            ))}
            <path
              d={wavePath((40 + 70 * pulse) * (0.6 + 0.4 * energy(abs)), 0.012, f * 0.25, 0, 1)}
              fill="none"
              stroke={C.blue}
              strokeWidth={3.5}
              strokeDasharray={4000}
              strokeDashoffset={4000 * (1 - waveIn)}
              style={{ filter: glow(0.8) }}
            />
          </svg>
          <div style={{ position: "absolute", left: 120, top: 190, opacity: 1 - ramp(f, IM - 6, 12) }}>
            <Hero text="GROOVE" size={240} t={f - GR - 6} mode="track" dur={16} />
          </div>
          {f >= IM && (
            <div style={{ position: "absolute", left: 1150, top: 470 - 380 * settle + 0, opacity: ramp(f, IM + 10, 14) }}>
              <Hero text="IMPROVE" size={150} t={f - IM - 10} dur={16} stagger={1.4} color={C.white} />
            </div>
          )}
        </AbsoluteFill>
      )}
      <Vignette />
    </AbsoluteFill>
  );
};
