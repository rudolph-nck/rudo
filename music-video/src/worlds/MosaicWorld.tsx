import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import deptData from "../../data/departments.json";
import placesData from "../../data/places.json";
import { BrandLine } from "../components/Brand";
import { Field, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { Obj, Stage3D } from "../three/Stage3D";
import { C, F } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam, camPath } from "../utils/camera";
import { clamp01, cubicInOut, expoIn, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { hash01, rng } from "../utils/random";
import { beatPulse } from "../utils/time";
import { useWorld } from "../utils/scenes";

const COLS = 16,
  ROWS = 12,
  CW = 112,
  CH = 76;
const BACKZ = -4200;

// plus polygon (brand geometry) normalised to 0..1 in its own bbox
const PLUS_POLY: Array<[number, number]> = [
  [25.743, 8.086],
  [22.652, 13.26],
  [15.494, 13.26],
  [15.494, 21.349],
  [10.32, 21.349],
  [10.32, 13.26],
  [0, 13.26],
  [3.106, 8.086],
  [10.32, 8.086],
  [10.32, 0],
  [15.494, 0],
  [15.494, 8.086],
].map(([x, y]) => [x / 25.743, y / 21.349]);
const inPoly = (x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = PLUS_POLY.length - 1; i < PLUS_POLY.length; j = i++) {
    const [xi, yi] = PLUS_POLY[i],
      [xj, yj] = PLUS_POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const MosaicWorld: React.FC = () => {
  const { f, L, abs } = useWorld("beatcut");
  const FL = L("frontline"),
    BO = L("backoffice"),
    MX = L("mix"),
    NM = L("names"),
    RL = L("roles"),
    PC = L("piece"),
    TA = L("thatsaddition");
  const base = baseCam(40);
  const P = base.z;

  const cells = useMemo(() => {
    const places = placesData.places.map((p) => ({ w: p.name, kind: "place" }));
    const depts = deptData.departments.filter((d) => d.id !== "d16").map((d) => ({ w: d.name.replace("\n", " "), kind: "dept" }));
    const all = [...places, ...depts];
    const r = rng(183);
    const order = all.map((_, i) => i).sort(() => r() - 0.5);
    return Array.from({ length: COLS * ROWS }, (_, i) => {
      const c = i % COLS,
        rr = Math.floor(i / COLS);
      const item = all[order[i % all.length]];
      const gx = (c - (COLS - 1) / 2) * CW;
      const gy = (rr - (ROWS - 1) / 2) * CH;
      // plus drawn slightly smaller than the grid
      const u = (c + 0.5) / COLS,
        v = (rr + 0.5) / ROWS;
      const pu = (u - 0.08) / 0.84,
        pv = (v - 0.04) / 0.92;
      return {
        ...item,
        gx,
        gy,
        plus: pu > 0 && pu < 1 && pv > 0 && pv < 1 && inPoly(pu, pv),
        sx: (r() - 0.5) * 4200,
        sy: (r() - 0.5) * 2600,
        sz: BACKZ + (r() - 0.5) * 3600,
        rot: (r() - 0.5) * 180,
        delay: r() * 16,
        lightAt: r() * 26,
      };
    });
  }, []);

  const cam = camPath(
    f,
    [
      [FL, { z: P * 1.02 }],
      [MX - 8, { z: P * 0.98 }],
      [MX + 26, { z: BACKZ + P * 1.0 }, expoInOut],
      [MX + 20, { z: BACKZ + P * 1.08 }],
      [TA, { z: BACKZ + P * 1.02 }],
      [TA + 40, { z: BACKZ + P * 1.16 }, expoOut],
    ],
    base,
    cubicInOut,
  );

  const settle = (c: (typeof cells)[number]) => expoInOut(clamp01((f - MX - c.delay) / 34));
  const plusOn = ramp(f, TA, 12, expoOut);

  return (
    <AbsoluteFill>
      <Field />
      <ParticleField cam={cam} frame={f} count={220} opacity={0.3} size={1.6} seed={31} box={{ x: [-3000, 3000], y: [-1800, 1800], z: [-8000, 1200] }} />
      {f >= TA - 4 && <LightPool x={960} y={540} r={900} color={C.blueRGB} opacity={0.22 * plusOn} />}
      <Stage3D cam={cam}>
        {/* every team in the mix → the wall */}
        {f >= MX - 2 &&
          cells.map((c, i) => {
            const s = settle(c);
            const place = c.kind === "place";
            let op = 0.55;
            let col: string = C.white;
            if (f >= NM && f < RL) op = place ? 1 : 0.18;
            if (f >= RL && f < PC) op = place ? 0.18 : 1;
            if (f >= PC && f < TA) {
              const lit = f - PC > c.lightAt;
              op = lit ? 0.95 : 0.2;
              col = lit && hash01(i) > 0.7 ? C.blue : C.white;
            }
            if (f >= TA) {
              op = c.plus ? mix(0.5, 1, plusOn) : mix(0.5, 0.06, plusOn);
              col = c.plus ? C.blue : C.white;
            }
            return (
              <Obj key={i} x={mix(c.sx, c.gx, s)} y={mix(c.sy, c.gy, s)} z={mix(c.sz, BACKZ, s)} rz={mix(c.rot, 0, s)} opacity={op * ramp(f, MX + c.delay * 0.3, 8)}>
                <div
                  style={{
                    width: CW - 10,
                    fontFamily: F.hero,
                    fontWeight: 700,
                    fontSize: 15,
                    lineHeight: 1.1,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                    color: col,
                    textAlign: "center",
                    textShadow: col === C.blue && f >= TA ? `0 0 12px rgba(${C.blueRGB},0.8)` : undefined,
                  }}
                >
                  {c.w}
                </div>
              </Obj>
            );
          })}
      </Stage3D>

      {/* FRONT LINE. / BACK OFFICE. — sung back to back, stacked, pulsing on the beat until the wall */}
      {f >= FL - 2 && f < MX + 16 && (() => {
        const kick = beatPulse(abs, 5);
        const out = expoIn(ramp(f, MX - 10, 11));
        const row = (label: string, text: string, at: number, color: string, top: number) => (
          <div style={{ position: "absolute", left: 180, top, transform: `scale(${1 + 0.035 * kick * ramp(f, at + 6, 6)})`, transformOrigin: "0% 100%" }}>
            <Mono text={label} t={f - at} size={18} opacity={0.55} />
            <div style={{ height: 10 }} />
            <Hero text={text} size={210} t={f - at} dur={10} stagger={0.8} tracking={-0.04} color={color} />
          </div>
        );
        return (
          <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 + 0.25 * out})`, transformOrigin: "50% 50%" }}>
            {row("01 · FRONT", "FRONT LINE.", FL, C.white, 170)}
            <div style={{ position: "absolute", left: 180, top: 540, width: 1560, height: 6, background: C.blue,
              transform: `scaleX(${ramp(f, FL + 4, 20, expoOut)})`, transformOrigin: "0 50%",
              boxShadow: `0 0 ${12 + 26 * kick}px rgba(${C.blueRGB},${0.5 + 0.5 * kick})` }} />
            {row("02 · BACK", "BACK OFFICE.", BO, C.lunar, 580)}
          </AbsoluteFill>
        );
      })()}

      {/* line-level hero statements */}
      {f < FL && (
        <AbsoluteFill style={{ background: "#000" }}>
          <div style={{ position: "absolute", left: 110, bottom: 80 }}>
            <Mono text="BEAT CUT" t={f - 4} size={15} opacity={0.4} />
          </div>
          <div style={{ position: "absolute", left: 960, top: 540, width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 5, background: C.blue,
            boxShadow: `0 0 ${10 + 30 * beatPulse(abs, 6)}px rgba(${C.blueRGB},0.9)`, transform: `scale(${1 + 1.2 * beatPulse(abs, 6)})` }} />
          <div style={{ position: "absolute", left: 960, top: 539, height: 2, width: 1400 * ramp(f, FL - 40, 36, expoInOut), marginLeft: -700 * ramp(f, FL - 40, 36, expoInOut),
            background: C.blue, opacity: 0.8 }} />
        </AbsoluteFill>
      )}
      {[
        ["mix", MX, NM, "EVERY TEAM\nIN THE MIX."],
        ["names", NM, RL, "DIFFERENT\nNAMES."],
        ["roles", RL, PC, "DIFFERENT\nROLES."],
        ["piece", PC, TA, "EVERY PIECE\nMATTERS."],
      ].map(([id, s, e, text]) => {
        const S = s as number,
          E = e as number;
        if (f < S || f > E) return null;
        return (
          <div key={id as string} style={{ position: "absolute", left: 110, bottom: 90, opacity: 1 - ramp(f, E - 5, 5) }}>
            <div style={{ position: "absolute", inset: "-30px -40px", background: "radial-gradient(closest-side, rgba(6,7,8,0.85), rgba(6,7,8,0))" }} />
            <div style={{ position: "relative" }}>
              <Hero text={text as string} size={96} t={f - S} dur={10} stagger={0.8} tracking={-0.03} lineHeight={0.95} />
            </div>
          </div>
        );
      })}
      {f >= TA && (
        <div style={{ position: "absolute", left: 110, bottom: 90 }}>
          <div style={{ position: "absolute", inset: "-30px -40px", background: "radial-gradient(closest-side, rgba(6,7,8,0.85), rgba(6,7,8,0))" }} />
          <div style={{ position: "relative" }}>
            <Hero text={"THAT’S\nADDITION."} size={120} t={f - TA} dur={12} stagger={1} tracking={-0.035} lineHeight={0.92} />
          </div>
        </div>
      )}
      <Vignette strength={0.62} />
    </AbsoluteFill>
  );
};
