import React from "react";
import { AbsoluteFill } from "remotion";
import deptData from "../../data/departments.json";
import { AplusMark, PlusMark } from "../components/Brand";
import { Glyph } from "../components/Glyphs";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { Obj, Stage3D } from "../three/Stage3D";
import { C, F, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam, Cam } from "../utils/camera";
import { clamp01, cubicInOut, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { chapter, useWorld } from "../utils/scenes";
import { beatPulse } from "../utils/time";

const DEPTS = deptData.departments;
const STEP = 1900;
const sx = (i: number) => (i + 1) * STEP;

/** four movements of the Rail: flat → angled → low → high */
const MOVES: Array<{ until: number; ry: number; rx: number; y: number; zk: number }> = [
  { until: 3, ry: 0, rx: 0, y: -80, zk: 1.0 },
  { until: 9, ry: -16, rx: 5, y: -160, zk: 0.95 },
  { until: 17, ry: 12, rx: -7, y: 120, zk: 0.92 },
  { until: 99, ry: -7, rx: 17, y: -420, zk: 1.0 },
];
const moveOf = (i: number) => MOVES.find((m) => i <= m.until)!;

const SCATTER = (() => {
  const r = rng(116);
  return Array.from({ length: 36 }, (_, i) => ({ x: 120 + r() * 1680, y: 120 + r() * 840, tx: 60 + i * 52 }));
})();

export const RailWorld: React.FC = () => {
  const { f, L, abs } = useWorld("departments");
  const off = chapter("departments").startFrame;
  const D0 = L("departments");
  const RING = L("oneaddition");
  const starts = DEPTS.map((d) => L(d.id));
  const base = baseCam(40);

  // ---------- camera along the rail ----------
  let cur = -1;
  starts.forEach((s, i) => {
    if (f >= s - 4) cur = i;
  });
  const camFor = (i: number) => {
    const m = i < 0 ? MOVES[0] : moveOf(i);
    return { x: i < 0 ? 300 : sx(i) - 170, y: m.y, ry: m.ry, rx: m.rx, z: base.z * m.zk };
  };
  const a = camFor(cur - 1),
    b = camFor(cur);
  const tt = cur < 0 ? 1 : expoInOut(clamp01((f - (starts[cur] - 4)) / 20));
  const drift = cur < 0 ? 0 : (f - starts[cur]) * 0.9;
  const cam: Cam = {
    ...base,
    x: mix(a.x, b.x, tt) + drift,
    y: mix(a.y, b.y, tt),
    z: mix(a.z, b.z, tt),
    rx: mix(a.rx, b.rx, tt),
    ry: mix(a.ry, b.ry, tt),
  };
  if (cur < 0) {
    // intro: rail seen whole, zooms on "GOOOO"
    const go = ramp(f, D0 + 40, 40, expoInOut);
    cam.x = mix(0, 900, go);
    cam.y = 0;
    cam.z = base.z * mix(1.25, 1.0, go);
  }

  const ringT = ramp(f, RING - 2, 26, expoInOut);
  const railOpacity = 1 - ringT;
  const pulse = beatPulse(abs, 6);

  // intro dots → one line
  const gather = ramp(f, D0 + 2, 22, expoInOut);

  return (
    <AbsoluteFill>
      <Field />
      {/* A+ lattice — brand texture, barely there */}
      <AbsoluteFill style={{ opacity: 0.035 * railOpacity, transform: `translateX(${-((cam.x * 0.08) % 240)}px)` }}>
        {Array.from({ length: 5 * 10 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: (i % 10) * 240 - 60, top: Math.floor(i / 10) * 240 + 20 }}>
            <AplusMark height={90} plusColor={C.white} />
          </div>
        ))}
      </AbsoluteFill>
      <ParticleField cam={cam} frame={f} count={260} opacity={0.3} size={1.8} seed={17} box={{ x: [-2000, 56000], y: [-1400, 1400], z: [-3000, 500] }} />

      <AbsoluteFill style={{ opacity: railOpacity }}>
        <Stage3D cam={cam}>
          {/* the rail */}
          <Obj x={-3000} y={0} anchor="left" cull={false}>
            <div style={{ width: 62000 * (cur < 0 ? gather : 1), height: 5, background: C.blue, filter: glow(0.7 + 0.5 * pulse) }} />
          </Obj>
          {/* minor ticks */}
          {Array.from({ length: 150 }, (_, k) => {
            const x = -1000 + k * 380;
            if (Math.abs(x - cam.x) > 5000) return null;
            return (
              <Obj key={k} x={x} y={8} anchor="top">
                <div style={{ width: 1, height: k % 5 === 0 ? 26 : 12, background: C.anchor }} />
              </Obj>
            );
          })}
          {/* stations */}
          {DEPTS.map((d, i) => {
            const x = sx(i);
            if (Math.abs(x - cam.x) > 5200 || cur < 0) return null;
            const t = f - starts[i];
            const isCur = i === cur;
            const op = isCur ? 1 : 0.22;
            const loud = d.glyph === "loud" && isCur && t > 18;
            return (
              <React.Fragment key={d.id}>
                <Obj x={x - 780} y={0} anchor="center">
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: isCur ? C.white : C.blue, boxShadow: `0 0 18px rgba(${C.blueRGB},0.9)` }} />
                </Obj>
                <Obj x={x - 780} y={-40} anchor="bottom-left" opacity={op * (loud ? 0.25 : 1)}>
                  <div>
                    <Mono text={`D.${String(i + 1).padStart(2, "0")} / 27`} t={isCur ? t : 999} size={20} opacity={0.6} color={isCur ? C.blue : C.white} />
                    <div style={{ height: 14 }} />
                    <Hero text={d.name.toUpperCase()} size={104} t={isCur ? t : 999} dur={12} stagger={0.7} tracking={-0.03} lineHeight={0.95} />
                  </div>
                </Obj>
                <Obj x={x + 470} y={-230} anchor="center" opacity={isCur ? 1 : 0.15}>
                  <Glyph kind={d.glyph} t={isCur ? t : 60} size={300} />
                </Obj>
              </React.Fragment>
            );
          })}
        </Stage3D>
      </AbsoluteFill>

      {/* intro: the named places fall into one line */}
      {f < starts[0] + 10 && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, starts[0] - 6, 14) }}>
          {SCATTER.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: mix(p.x, p.tx, gather) - 4, top: mix(p.y, 540, gather) - 4, width: 8, height: 8, borderRadius: 4,
              background: C.blue, boxShadow: `0 0 12px rgba(${C.blueRGB},0.9)`, opacity: 1 - ramp(f, D0 + 22, 10) }} />
          ))}
          <div style={{ position: "absolute", left: 110, top: 200 }}>
            <Mono text="BEAT SWITCH · 02" t={f - D0} size={16} opacity={0.55} />
            <div style={{ height: 14 }} />
            <Hero text="DEPARTMENTS" size={210} t={f - D0 - 2} dur={12} stagger={1} tracking={-0.035} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 640, whiteSpace: "nowrap" }}>
            {(() => {
              const t = f - (D0 + 44);
              if (t < 0) return null;
              const os = Math.min(7, 2 + Math.floor(t / 3));
              return (
                <div style={{ fontFamily: F.hero, fontWeight: 800, fontSize: 170, letterSpacing: "-0.03em", color: C.white, lineHeight: 1 }}>
                  LET’S G
                  {Array.from({ length: os }, (_, k) => (
                    <span key={k} style={{ color: k === os - 1 ? C.blue : C.white, opacity: 1 - k * 0.07, display: "inline-block", transform: `scale(${k === os - 1 ? expoOut(clamp01((t % 3) / 3)) : 1})` }}>
                      O
                    </span>
                  ))}
                  !
                </div>
              );
            })()}
          </div>
        </AbsoluteFill>
      )}

      {/* LOUD */}
      {(() => {
        const i = DEPTS.findIndex((d) => d.glyph === "loud");
        const t = f - starts[i];
        if (t < 16 || f >= starts[i + 1]) return null;
        return (
          <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - ramp(f, starts[i + 1] - 6, 6) }}>
            <div style={{ transform: `scale(${1 + 0.04 * beatPulse(abs, 5)})` }}>
              <Hero text="LOUD" size={640} t={t - 16} dur={8} stagger={1} tracking={-0.05} color={C.white} />
            </div>
          </AbsoluteFill>
        );
      })()}

      {/* the rail closes into a ring — ONE ADDITION */}
      {f >= RING - 4 && (
        <AbsoluteFill>
          <LightPool x={1260} y={540} r={700} color={C.blueRGB} opacity={0.1 * ringT} />
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <circle cx={1260} cy={540} r={360} fill="none" stroke={C.blue} strokeWidth={5} strokeDasharray={2262} strokeDashoffset={2262 * (1 - ringT)}
              transform={`rotate(${180 + f * 0.3} 1260 540)`} style={{ filter: glow(0.8) }} />
          </svg>
          {DEPTS.map((d, i) => {
            const an = (i / DEPTS.length) * 360 + (f - RING) * 0.25 - 90;
            const r = mix(900, 400, ringT);
            const x = 1260 + Math.cos((an * Math.PI) / 180) * r;
            const y = 540 + Math.sin((an * Math.PI) / 180) * r;
            const flip = Math.cos((an * Math.PI) / 180) < 0;
            return (
              <div key={d.id} style={{ position: "absolute", left: x, top: y, transform: `rotate(${flip ? an + 180 : an}deg)`, transformOrigin: "0 0", opacity: ringT }}>
                <div style={{ transform: flip ? "translate(-100%,-50%)" : "translate(0,-50%)", paddingLeft: flip ? 0 : 14, paddingRight: flip ? 14 : 0 }}>
                  <Mono text={d.name.replace("\n", " ")} t={999} size={13} opacity={0.75} />
                </div>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 1260, top: 540, transform: `translate(-50%,-50%) scale(${expoOut(ramp(f, RING + 10, 20))})` }}>
            <PlusMark size={170} glowAmt={1} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 300 }}>
            <Mono text="DIFFERENT ROLES · 27 LINES · 1" t={f - RING} size={16} opacity={0.55} />
            <div style={{ height: 16 }} />
            <Hero text={"ONE\nADDITION"} size={170} t={f - RING - 8} dur={12} stagger={1} tracking={-0.035} lineHeight={0.92} />
            <div style={{ height: 22 }} />
            <Hero text="EVERY DAY." size={60} t={f - RING - 30} dur={12} stagger={0.8} color={C.blue} />
          </div>
        </AbsoluteFill>
      )}
      <Flash at={D0} peak={0.3} />
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};
