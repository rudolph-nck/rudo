import React from "react";
import { AbsoluteFill } from "remotion";
import { LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { C, glow } from "../theme";
import { Mono, Narrative, Serif } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { cubicInOut, expoInOut, expoOut, mix, ramp, sineInOut } from "../utils/ease";
import { useWorld } from "../utils/scenes";

const LX = 560; // the margin line

/**
 * Bridge — the one intimate chapter: warm dark, serif type, dust in a single
 * pool of light, and one vertical line like a page margin.
 */
export const BridgeWorld: React.FC = () => {
  const { f, L, dur, txt } = useWorld("bridge");
  const V = [
    { a: L("learn"), b: L("learn2"), n: "i.", w: "Learn.", s: txt("learn2") },
    { a: L("teach"), b: L("teach2"), n: "ii.", w: "Teach.", s: txt("teach2") },
    { a: L("improve2"), b: L("improve3"), n: "iii.", w: "Improve.", s: txt("improve3") },
    { a: L("integrity"), b: L("integrity2"), n: "iv.", w: "Absolute\nIntegrity.", s: txt("integrity2") },
  ];
  const END = dur;
  const ROT = END - 26; // the line turns to lead the way

  const cur = V.filter((v) => f >= v.a - 4).length - 1;
  const lineTop = mix(1080, -40, ramp(f, 4, 60, expoOut)); // first line rises
  const second = ramp(f, V[1].b, 40, expoInOut); // "someone helped us grow"
  const tick = ramp(f, V[2].a + 6, 16, expoOut);
  const pass = ramp(f, V[2].b, 36, cubicInOut);
  const bright = ramp(f, V[3].a, 20);
  const rot = ramp(f, ROT, 24, expoInOut);
  const cam = baseCam(40, { y: -f * 0.6 });

  return (
    <AbsoluteFill style={{ background: "#0B0A09" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 80% at 58% 20%, #1a1611 0%, #0B0A09 70%)" }} />
      <LightPool x={1100} y={260} r={900} color="255,226,190" opacity={0.1} squash={0.9} />
      <ParticleField cam={cam} frame={f} count={320} opacity={0.5} size={1.5} seed={77} color="255,236,210" blueRatio={0.03}
        box={{ x: [-1400, 1400], y: [-1600, 1600], z: [-1600, 900] }} drift={[0.15, -0.35, 0]} twinkle={0.8} />

      {/* the margin line(s) */}
      <div style={{ position: "absolute", left: mix(LX, 960, rot), top: 540, width: 0, height: 0, transform: `rotate(${mix(0, -90, rot)}deg)` }}>
        <div style={{ position: "absolute", left: -mix(1, 2, bright), top: mix(lineTop - 540, -1200, rot), width: mix(2, 4, bright), height: mix(1080 - lineTop, 2400, rot),
          background: C.blue, filter: glow(0.4 + 0.8 * bright) }} />
      </div>
      {second > 0 && rot < 0.2 && (
        <div style={{ position: "absolute", left: LX + 26, top: mix(1080, 300, second), width: 1.5, height: 1080 - mix(1080, 300, second), background: C.warm, opacity: 0.55 * (1 - ramp(f, V[3].a, 16)) }} />
      )}
      {/* GOOD ENOUGH tick — the line's head passes it */}
      {tick > 0 && f < V[3].a + 10 && (
        <div style={{ opacity: 1 - ramp(f, V[3].a - 6, 14) }}>
          <div style={{ position: "absolute", left: LX - 40 * tick, top: 460, width: 80 * tick, height: 1.5, background: C.warm, opacity: 0.8 }} />
          <div style={{ position: "absolute", left: LX - 250, top: 446 }}>
            <Mono text="GOOD ENOUGH" t={f - V[2].a - 10} size={15} color={C.warm} opacity={0.6} />
          </div>
          <div style={{ position: "absolute", left: LX - 7, top: mix(520, 60, pass) - 7, width: 14, height: 14, borderRadius: 7, background: C.white, boxShadow: `0 0 18px rgba(${C.blueRGB},0.9)` }} />
        </div>
      )}

      {/* the four values */}
      {V.map((v, i) => {
        const next = V[i + 1]?.a ?? ROT + 10;
        if (f < v.a - 4 || f > next + 2) return null;
        const out = ramp(f, next - 10, 12, sineInOut);
        return (
          <div key={i} style={{ position: "absolute", left: LX + 90, top: i === 3 ? 250 : 330 }}>
            <Serif text={v.n} size={46} italic t={f - v.a} dur={20} out={out} color={C.blue} />
            <div style={{ height: 6 }} />
            <Serif text={v.w} size={i === 3 ? 170 : 210} t={f - v.a - 4} dur={34} out={out} lineHeight={0.95} />
            <div style={{ height: 34 }} />
            <Narrative text={v.s} t={f - v.b} out={out} size={40} color={C.warm} wordStagger={3} dur={20} />
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 110, top: 80, opacity: ramp(f, 10, 30) * (1 - rot) }}>
        <Mono text={`BRIDGE · VALUES · ${["I", "II", "III", "IV"][Math.max(0, cur)]}`} t={f - 10} size={14} color={C.warm} opacity={0.4} />
      </div>
      <Vignette strength={0.7} />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - ramp(f, 0, 14) }} />
    </AbsoluteFill>
  );
};

