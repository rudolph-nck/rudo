import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { Lines3D, Seg3 } from "../three/Lines3D";
import { ParticleField } from "../three/Particles";
import { Obj, Stage3D } from "../three/Stage3D";
import { C } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam, Cam, camPath } from "../utils/camera";
import { cubicInOut, expoIn, expoInOut, expoOut, mix, ramp, sineInOut } from "../utils/ease";
import { rng } from "../utils/random";
import { chapter, useWorld } from "../utils/scenes";
import { beatIndex, beatPulse, downbeatPulse, DOWNBEATS } from "../utils/time";

const GROUND = 260;
const ROAD_Z0 = -9000;
const V = 62; // road speed px/frame
const TUNNEL = [
  { w: "2026", x: -520, y: -220, sub: "01 · JAN" },
  { w: "CHANGIN’", x: 420, y: 180, sub: "Q1" },
  { w: "ENVISION", x: -480, y: 230, sub: "+ ADDITION" },
  { w: "ONE CALL", x: 520, y: -240, sub: "TLH ⟷ ORL" },
  { w: "CONVERSION", x: -380, y: -180, sub: "03 · MAR" },
  { w: "LONG DAYS", x: 470, y: 230, sub: "DAY 089" },
  { w: "GROOVE", x: -500, y: 200, sub: "107.7 BPM" },
  { w: "IMPROVE", x: 380, y: -200, sub: "↗" },
];

export const ChorusWorld: React.FC = () => {
  const { f, L, W, abs } = useWorld("chorus");
  const off = chapter("chorus").startFrame;
  const O1 = L("otor1"),
    O2 = L("otor2"),
    LK = L("lookdid"),
    RD = L("roads1"),
    AS = L("asone"),
    HW = L("howwemove");
  const words = [L("learned1"), L("taught1"), L("changed1"), L("grew1")];
  const WORDS = ["LEARNED", "TAUGHT", "CHANGED", "GREW"];

  const base = baseCam(40);
  const P = base.z;

  // road camera z (continuous, accelerating after HW)
  const roadZ = (fr: number) => {
    const d = Math.max(0, fr - RD);
    const h = Math.max(0, fr - HW);
    return ROAD_Z0 - V * d - 5 * h * h;
  };

  let cam: Cam;
  if (f < RD) {
    cam = camPath(
      f,
      [
        [O1, { z: P * 1.04 }],
        [O2, { z: P * 0.98, ry: 0, x: 0 }],
        [O2 + 20, { ry: -10, x: 260, z: P * 1.1 }, expoOut],
        [LK, { ry: -4, x: 120, z: P * 1.0 }, sineInOut],
        [LK + 8, { ry: 0, x: 0, z: P * 0.9 }],
        [RD, { z: ROAD_Z0, y: 0, rx: 3 }, (t) => mix(t, expoIn(t), 0.35)],
      ],
      base,
      cubicInOut,
    );
  } else {
    const crane = ramp(f, AS, 36, expoInOut);
    cam = { ...base, z: roadZ(f), y: mix(0, -360, crane), rx: mix(3, 9, crane), ry: 0, x: 0 };
  }

  // downbeat breath on hero type
  const db = downbeatPulse(abs, 6);
  const heroScale = 1 + 0.022 * db;
  const bi = beatIndex(abs);
  const inBar = ((bi - 2) % 4 + 4) % 4; // downbeat phase = 2

  // ---------- road geometry ----------
  const roadSegs = useMemo(() => {
    const s: Seg3[] = [];
    const zEnd = -70000;
    // centre line = the brand line, split so it tapers with depth
    for (let z = ROAD_Z0 + 2000; z > zEnd; z -= 500) s.push({ a: [0, GROUND, z], b: [0, GROUND, z - 500], color: C.blueRGB, width: 7, glow: 8 });
    // lane dashes + edges
    for (let z = ROAD_Z0 + 2000; z > zEnd; z -= 600) {
      for (const x of [-230, 230]) s.push({ a: [x, GROUND, z], b: [x, GROUND, z - 260], width: 5, alpha: 0.55 });
      for (const x of [-470, 470]) s.push({ a: [x, GROUND, z], b: [x, GROUND, z - 600], width: 3, alpha: 0.35 });
    }
    // side roads merging from both sides
    const r = rng(64);
    const merges = [-11200, -12600, -14200, -16500, -19500];
    merges.forEach((zm, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const len = 5200 + r() * 2000;
      const ang = 0.35 + r() * 0.25;
      const x0 = side * (470 + Math.sin(ang) * len);
      const z0 = zm + Math.cos(ang) * len;
      const n = 14;
      for (let k = 0; k < n; k++) {
        const t0 = k / n,
          t1 = (k + 0.7) / n;
        const p = (t: number): [number, number, number] => [mix(x0, side * 470, t), GROUND, mix(z0, zm, t)];
        s.push({ a: p(t0), b: p(t1), width: 4, alpha: 0.5 });
        s.push({ a: [p(t0)[0] + side * 300, GROUND, p(t0)[2]], b: [p(t1)[0] + side * 300, GROUND, p(t1)[2]], width: 3, alpha: 0.28 });
      }
    });
    return s;
  }, []);
  const horizon: Seg3[] = [{ a: [-90000, GROUND, cam.z - 60000], b: [90000, GROUND, cam.z - 60000], color: C.blueRGB, width: 3, px: true, glow: 10, alpha: 0.9 }];

  const typeOut = ramp(f, LK - 2, 14);
  const beatSegs = [0, 1, 2, 3];

  return (
    <AbsoluteFill>
      <Field />
      <ParticleField cam={cam} frame={f} count={f >= RD ? 500 : 240} opacity={0.45} size={1.8} seed={21}
        box={{ x: [-4000, 4000], y: [-1800, 240], z: [cam.z - 9000, cam.z + 600] }} drift={[0, 0, 0]} />

      {f >= RD - 6 && (
        <AbsoluteFill style={{ opacity: ramp(f, RD - 6, 14) }}>
          <LightPool x={960} y={mix(560, 470, ramp(f, AS, 36))} r={1100} squash={0.22} color={C.blueRGB} opacity={0.12} />
          <Lines3D cam={cam} segs={[...roadSegs, ...horizon]} fadeFar={42000} />
        </AbsoluteFill>
      )}

      <Stage3D cam={cam}>
        {/* ONE TEAM / ONE RHYTHM */}
        {f < LK + 30 && (
          <>
            <Obj x={-820} y={-10} anchor="bottom-left" opacity={1 - typeOut * 0.2}>
              <div style={{ transform: `scale(${heroScale})`, transformOrigin: "0 100%" }}>
                <Hero text="ONE TEAM" size={250} t={f - O1 + 2} dur={12} stagger={1.3} tracking={-0.035} />
              </div>
            </Obj>
            <Obj x={-820} y={240} anchor="bottom-left" opacity={1 - typeOut * 0.2}>
              <div style={{ transform: `scale(${heroScale})`, transformOrigin: "0 100%" }}>
                <Hero text="ONE RHYTHM" size={250} t={f - (f >= O2 ? W("otor2", 2) : W("otor1", 2))} dur={12} stagger={1.3} tracking={-0.035} color={C.blue} />
              </div>
            </Obj>
            {/* beat meter — the line keeps time */}
            <Obj x={-820} y={300} anchor="left">
              <div style={{ display: "flex", gap: 22 }}>
                {beatSegs.map((k) => {
                  const on = k === inBar && f >= O1;
                  return (
                    <div key={k} style={{ width: 380, height: 6, background: on ? C.blue : "rgba(255,255,255,0.14)", opacity: on ? 0.55 + 0.45 * beatPulse(abs, 5) : 1,
                      boxShadow: on ? `0 0 16px rgba(${C.blueRGB},0.7)` : undefined, transform: `scaleX(${ramp(f, O1 + k * 3, 16, expoOut)})`, transformOrigin: "0 50%" }} />
                  );
                })}
              </div>
            </Obj>
            <Obj x={-820} y={330} anchor="top-left">
              <Mono text={`BAR ${String(Math.max(1, Math.floor((abs / 30 - DOWNBEATS[0]) / 2.229) + 1)).padStart(3, "0")} · BEAT ${inBar + 1}/4 · 107.7 BPM`} t={f - O1 - 8} size={15} opacity={0.5} />
            </Obj>
          </>
        )}

        {/* everything we did — words through depth */}
        {f >= LK - 10 &&
          f < RD + 10 &&
          TUNNEL.map((w, i) => {
            const z = P * 0.9 - 1400 - i * 950;
            return (
              <Obj key={w.w} x={w.x} y={w.y} z={z} opacity={ramp(f, LK - 10 + i * 2, 12)}>
                <div style={{ textAlign: "left" }}>
                  <Mono text={w.sub} t={999} size={22} opacity={0.55} color={i % 3 === 0 ? C.blue : C.white} />
                  <Hero text={w.w} size={150} t={999} color={C.white} />
                </div>
              </Obj>
            );
          })}

        {/* AS ONE stands at the end of the merged road */}
        {f >= AS - 20 && f < words[1] && (
          <Obj x={0} y={GROUND - 20} z={roadZ(AS) - 5200} anchor="bottom" opacity={ramp(f, AS - 20, 20) * (1 - ramp(f, words[0] - 6, 12))}>
            <Hero text="AS ONE" size={900} t={f - AS + 4} dur={16} stagger={2} tracking={-0.04} />
          </Obj>
        )}

        {/* the words painted on the road */}
        {words.map((w0, i) => {
          if (f < w0 - 30 || f > w0 + 70) return null;
          const z = roadZ(w0 + 12) - 1500;
          return (
            <Obj key={i} x={0} y={GROUND - 1} z={z} rx={90} opacity={ramp(f, w0 - 30, 20)}>
              <div style={{ transform: "scaleY(2.4)" }}>
                <Hero text={WORDS[i]} size={230} t={999} color={i === 3 ? C.blue : C.white} tracking={0.02} />
              </div>
            </Obj>
          );
        })}
      </Stage3D>

      {/* THAT'S HOW WE MOVE */}
      {f >= HW - 2 && (
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 110, top: 170 }}>
            <Hero text={"THAT’S HOW\nWE MOVE!"} size={190} t={f - HW + 2} dur={10} stagger={1} tracking={-0.035} />
          </div>
        </AbsoluteFill>
      )}
      <Flash at={O1} peak={0.35} />
      <Vignette strength={0.62} />
    </AbsoluteFill>
  );
};
