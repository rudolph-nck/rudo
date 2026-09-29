import React from "react";
import { AbsoluteFill } from "remotion";
import { BrandLine, Logo, PlusMark, Segment } from "../components/Brand";
import { Field, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { Obj, Stage3D } from "../three/Stage3D";
import { C, glow } from "../theme";
import { Hero, Mono, Serif } from "../typography/Type";
import { baseCam, camPath } from "../utils/camera";
import { clamp01, cubicInOut, expoIn, expoInOut, expoOut, keys, mix, quintOut, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { useWorld } from "../utils/scenes";
import { lowEnergy } from "../utils/time";

const VPX = 480; // the one destination (right third)
const LOGO_W = 700;
const LOGO_H = LOGO_W * (45.104 / 155.072);
const LOGO_S = LOGO_W / 155.072;
const PLUS_H = 21.349 * LOGO_S;
const PLUS_CX = -LOGO_W / 2 + ((155.311 + 181.054) / 2 - 143.16) * LOGO_S;
const LOGO_TOP = -(219.968 - 207.885 + 10.673) * LOGO_S; // plus bar centre sits on y=0
const BAR = 5.174 * LOGO_S;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const TIMELINE = { x0: 700, step: 700 };

type StoryLine = { sx: number; ang: number; len: number; bx: number; by: number; blen: number };
const STORIES: StoryLine[] = (() => {
  const r = rng(26);
  const ys = [-330, -250, -175, -110, -55, 60, 118, 180, 245, 310, -290, 280];
  return ys.map((by, i) => {
    let ang = (r() * 2 - 1) * 42;
    if (Math.abs(ang) < 10) ang += 14 * Math.sign(ang || 1);
    return {
      sx: -880 + i * 150 + r() * 60,
      ang,
      len: 260 + r() * 560,
      bx: -840 + r() * 380,
      by,
      blen: 380 + r() * 900,
    };
  });
})();

export const SignalWorld: React.FC = () => {
  const { f, L, txt } = useWorld("signal");
  const Y = L("yeah"),
    Y26 = L("y2026"),
    WY = L("whatayear"),
    RD = L("roads0"),
    ST = L("stories0"),
    DS = L("destination"),
    A0 = L("acu0");
  const RISE = 645,
    CUT = 867;

  // ---------- camera ----------
  const base = baseCam(40);
  const P = base.z;
  const cam = camPath(
    f,
    [
      [0, { z: P * 1.02 }],
      [Y26, { z: P * 0.985 }],
      [RD, { z: P * 0.93 }],
      [ST + 10, { z: P * 1.02, x: 0 }],
      [DS + 30, { z: P * 1.0, x: 90 }],
      [A0 + 20, { x: 0, z: P * 1.0 }],
      [RISE, { x: 0, z: P * 0.97 }],
      [RISE + 75, { x: 250, y: -170, z: 760, ry: -58, rx: 9 }, expoInOut],
      [CUT, { x: 9400, y: -120, z: 520, ry: -62, rx: 6 }, expoIn],
    ],
    base,
    cubicInOut,
  );

  // ---------- main line ----------
  const lineGrow = ramp(f, Y, 128, expoInOut);
  const collapse = ramp(f, DS + 8, 26, expoInOut);
  const xL = mix(-1300 * lineGrow, VPX, collapse);
  const xR = mix(1300 * lineGrow, VPX, collapse);
  const pulse = 0.6 + 0.4 * lowEnergy(f);

  // ---------- 2026 ----------
  const numOut = ramp(f, RD - 4, 18, cubicInOut);

  // ---------- plus → logo ----------
  const plusH = ramp(f, A0 - 2, 9, expoOut);
  const plusV = ramp(f, A0 + 3, 9, expoOut);
  const glide = ramp(f, A0 + 16, 26, expoInOut);
  const plusX = mix(VPX, PLUS_CX, glide);
  const plusSize = mix(150, PLUS_H, glide);
  const logoReveal = ramp(f, A0 + 40, 30, quintOut);
  const lockLines = ramp(f, A0 + 52, 40, expoOut);
  const logoOut = ramp(f, RISE, 26, cubicInOut);
  const bloom = Math.exp(-Math.max(0, f - A0) / 8) * (f >= A0 - 2 ? 1 : 0);

  // ---------- visibility ----------
  const cutBlack = f >= CUT;
  const riseT = ramp(f, RISE, CUT - RISE, (t) => t);

  return (
    <AbsoluteFill>
      <Field />
      {!cutBlack && (
        <>
          <ParticleField cam={cam} frame={f} count={260} opacity={0.35 + riseT * 0.3} size={1.6} seed={3}
            box={{ x: [-2600, 11000], y: [-1400, 1400], z: [-3500, 900] }} drift={[0, -0.25, 0]} />
          <Stage3D cam={cam}>
            {/* the point / the line */}
            {f < DS + 40 && (
              <Obj x={0} y={0} anchor="top-left">
                <div
                  style={{
                    position: "absolute",
                    left: xL,
                    top: -1.5,
                    width: Math.max(0, xR - xL),
                    height: 3,
                    background: C.blue,
                    filter: glow(0.8 * pulse),
                  }}
                />
                {f < Y + 20 && (
                  <div
                    style={{
                      position: "absolute",
                      left: -5,
                      top: -5,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: C.blue,
                      opacity: ramp(f, 12, 80, cubicInOut) * (1 - ramp(f, Y + 4, 16)),
                      transform: `scale(${0.8 + 0.4 * pulse})`,
                      filter: glow(1.2),
                    }}
                  />
                )}
              </Obj>
            )}

            {/* ruler ticks */}
            {f >= Y26 && f < RD + 30 && (
              <Obj x={0} y={0} anchor="top-left" opacity={1 - ramp(f, RD, 20)}>
                {Array.from({ length: 65 }, (_, k) => {
                  const i = k - 32;
                  const p = ramp(f, Y26 + Math.abs(i) * 0.5, 10, expoOut);
                  const h = i % 8 === 0 ? 22 : 9;
                  return (
                    <div key={k} style={{ position: "absolute", left: i * 40 - 0.5, top: 8, width: 1, height: h * p, background: C.anchor }} />
                  );
                })}
              </Obj>
            )}

            {/* 2026 — line passes behind the numerals */}
            {f >= Y26 - 2 && f < RD + 24 && (
              <Obj x={0} y={30} opacity={1 - numOut}>
                <div style={{ transform: `translateY(${numOut * 60}px)` }}>
                  <Hero text={txt("y2026").replace(".", "")} size={430} t={f - Y26} dur={22} stagger={3} tracking={-0.045} />
                </div>
              </Obj>
            )}

            {/* different roads / different stories / one destination */}
            {f >= RD && f < DS + 44 && (
              <Obj x={0} y={0} anchor="top-left">
                {STORIES.map((s, i) => {
                  const grow = ramp(f, RD + i * 1.5, 18, expoOut);
                  const toB = ramp(f, ST + i * 0.8, 22, expoInOut);
                  const toC = ramp(f, DS + i * 0.6, 16, expoInOut);
                  const toD = ramp(f, DS + 12 + i * 0.4, 20, expoInOut);
                  const ra = (s.ang * Math.PI) / 180;
                  const Ax1 = s.sx,
                    Ay1 = 0,
                    Ax2 = s.sx + Math.cos(ra) * s.len,
                    Ay2 = -Math.sin(ra) * s.len;
                  const Bx1 = s.bx,
                    By1 = s.by,
                    Bx2 = s.bx + s.blen,
                    By2 = s.by;
                  let x1 = mix(Ax1, Bx1, toB),
                    y1 = mix(Ay1, By1, toB),
                    x2 = mix(Ax2, Bx2, toB),
                    y2 = mix(Ay2, By2, toB);
                  x2 = mix(x2, VPX, toC);
                  y2 = mix(y2, 0, toC);
                  x1 = mix(x1, VPX, toD);
                  y1 = mix(y1, 0, toD);
                  return (
                    <React.Fragment key={i}>
                      <Segment x1={x1} y1={y1} x2={x2} y2={y2} w={1.4} progress={grow} color={C.white} opacity={0.55 + 0.35 * toC} />
                      <div
                        style={{
                          position: "absolute",
                          left: x1 - 34,
                          top: y1 - 9,
                          opacity: toB * (1 - toC),
                        }}
                      >
                        <Mono text={String(i + 1).padStart(2, "0")} t={f - ST - i} size={13} opacity={0.6} />
                      </div>
                    </React.Fragment>
                  );
                })}
              </Obj>
            )}

            {/* the destination point → plus → logo lockup */}
            {f >= DS + 20 && f < A0 + 4 && (
              <Obj x={VPX} y={0}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: C.white,
                    boxShadow: `0 0 ${20 + 40 * ramp(f, DS + 24, 10)}px rgba(${C.blueRGB},0.9)`,
                    transform: `scale(${ramp(f, DS + 22, 10, expoOut) * (1 + 0.3 * ramp(f, A0 - 8, 8))})`,
                  }}
                />
              </Obj>
            )}
            {f >= A0 - 2 && f < RISE + 30 && (
              <>
                {bloom > 0.02 && (
                  <Obj x={VPX} y={0}>
                    <div
                      style={{
                        width: 900,
                        height: 900,
                        borderRadius: 450,
                        background: `radial-gradient(closest-side, rgba(${C.blueRGB},${0.35 * bloom}), rgba(${C.blueRGB},0))`,
                      }}
                    />
                  </Obj>
                )}
                {logoReveal < 0.02 && (
                  <Obj x={plusX} y={0}>
                    <PlusMark size={plusSize} h={plusH} v={plusV} glowAmt={0.9} />
                  </Obj>
                )}
                <Obj x={-LOGO_W / 2} y={LOGO_TOP} anchor="top-left" opacity={1 - logoOut}>
                  <div
                    style={{
                      clipPath: `inset(0 ${(1 - logoReveal) * (1 - 0.2443) * 100}% 0 ${(1 - logoReveal) * 0.0783 * 100}%)`,
                      opacity: logoReveal > 0 ? 1 : 0,
                    }}
                  >
                    <Logo width={LOGO_W} />
                  </div>
                </Obj>
                {/* lockup lines at plus weight / alignment */}
                <Obj x={-LOGO_W / 2 - 46} y={0} anchor="right" opacity={1 - logoOut}>
                  <BrandLine length={900} thickness={BAR} progress={lockLines} from="right" glowAmt={0.3} />
                </Obj>
              </>
            )}

            {/* right lockup line → becomes the 2026 timeline */}
            {f >= A0 + 52 && (
              <Obj x={LOGO_W / 2 + 46} y={0} anchor="left">
                <BrandLine
                  length={12000}
                  thickness={mix(BAR, 6, ramp(f, RISE, 60))}
                  progress={Math.min(lockLines * (900 / 12000), 1) + ramp(f, RISE, 90, cubicInOut)}
                  from="left"
                  glowAmt={0.5}
                />
              </Obj>
            )}
            {f >= RISE && (
              <>
                <Obj x={TIMELINE.x0 + 520} y={-120} anchor="bottom-right" opacity={ramp(f, RISE + 30, 30)}>
                  <Hero text="2026" size={120} t={f - RISE - 30} dur={20} stagger={2} color={C.white} />
                </Obj>
                {MONTHS.map((m, i) => {
                  const x = TIMELINE.x0 + 700 + i * TIMELINE.step;
                  const appear = ramp(f, RISE + 40 + i * 8, 20, expoOut);
                  return (
                    <React.Fragment key={m}>
                      <Obj x={x} y={0} anchor="bottom">
                        <div style={{ width: 2, height: 70 * appear, background: C.white, opacity: 0.8 }} />
                      </Obj>
                      <Obj x={x + 14} y={-78} anchor="bottom-left" opacity={appear}>
                        <Mono text={`${String(i + 1).padStart(2, "0")} · ${m}`} t={f - RISE - 40 - i * 8} size={30} opacity={0.85} weight={500} />
                      </Obj>
                      {Array.from({ length: 9 }, (_, k) => (
                        <Obj key={k} x={x + (k + 1) * (TIMELINE.step / 10)} y={0} anchor="top">
                          <div style={{ width: 1, height: 16 * appear, background: C.anchor, marginTop: 6 }} />
                        </Obj>
                      ))}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </Stage3D>
          {/* light */}
          {f >= A0 - 2 && f < RISE + 40 && (
            <LightPool x={960} y={560} r={900} squash={0.35} color={C.blueRGB} opacity={0.08 * (1 - logoOut)} />
          )}
          {/* HUD */}
          <AbsoluteFill style={{ opacity: ramp(f, 30, 40) * (1 - ramp(f, RISE - 20, 30)) }}>
            <div style={{ position: "absolute", left: 96, bottom: 92 }}>
              <Mono text="ADDAPALOOZA — THE SUMMIT 2026" t={f - 30} size={14} opacity={0.42} />
            </div>
            <div style={{ position: "absolute", right: 96, bottom: 92, textAlign: "right" }}>
              <Mono text="ONE TEAM / ONE RHYTHM" t={f - 44} size={14} opacity={0.42} />
            </div>
            <div style={{ position: "absolute", left: 96, bottom: 66 }}>
              <Mono text="28.54°N  81.38°W" t={f - 58} size={14} opacity={0.32} />
            </div>
            <div style={{ position: "absolute", right: 96, bottom: 66 }}>
              <Mono
                text={`TC ${String(Math.floor(f / 1800)).padStart(2, "0")}:${String(Math.floor(f / 30) % 60).padStart(2, "0")}:${String(f % 30).padStart(2, "0")}`}
                t={999}
                size={14}
                opacity={0.32}
              />
            </div>
          </AbsoluteFill>
        </>
      )}
      {cutBlack && (
        <AbsoluteFill style={{ background: "#000" }}>
          <div
            style={{
              position: "absolute",
              left: 960 - 4,
              top: 540 - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              background: C.blue,
              filter: glow(1),
              opacity: ramp(f, CUT + 4, 10),
              transform: `scale(${1 + 2 * ramp(f, CUT + 20, 10, expoIn)})`,
            }}
          />
        </AbsoluteFill>
      )}
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};
