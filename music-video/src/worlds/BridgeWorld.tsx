import React from "react";
import { AbsoluteFill } from "remotion";
import { LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { C, glow } from "../theme";
import { Mono, Serif } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { clamp01, cubicInOut, cubicOut, expoInOut, expoOut, mix, ramp, sineInOut, softBack } from "../utils/ease";
import { useWorld } from "../utils/scenes";
import { F } from "../theme";

const WARM = "244,241,234";

/** A line-art stroke that draws itself in (pathLength-normalised). */
const Draw: React.FC<{ d: string; p: number; color?: string; w?: number; op?: number; fill?: string }> = ({ d, p, color = `rgba(${WARM},0.7)`, w = 2, op = 1, fill = "none" }) =>
  p <= 0 ? null : (
    <path d={d} pathLength={1} fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="1 1" strokeDashoffset={1 - clamp01(p)} opacity={op} />
  );

/**
 * One background glyph per value, drawn in thin warm line with blue accents:
 * Learn = an open book that keeps giving off sparks; Teach = a stake and the
 * sprout it helps grow; Improve = rising steps; Integrity = a compass that
 * settles on north.
 */
const ValueIcon: React.FC<{ i: number; f: number; a: number; b: number; g: number }> = ({ i, f, a, b, g }) => {
  const k = (s0: number, d: number) => ramp(f, s0, d, cubicOut);
  const blue = `rgba(${C.blueRGB},1)`;
  if (i === 0) {
    return (
      <g>
        <Draw d="M200 300 L200 150" p={k(a, 14)} />
        <Draw d="M200 150 Q140 120 60 140 L60 290 Q140 270 200 300" p={k(a + 2, 24)} />
        <Draw d="M200 150 Q260 120 340 140 L340 290 Q260 270 200 300" p={k(a + 2, 24)} />
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <Draw d={`M85 ${178 + r * 30} Q140 ${162 + r * 30} 180 ${182 + r * 30}`} p={k(a + 16 + r * 4, 14)} op={0.6} />
            <Draw d={`M315 ${178 + r * 30} Q260 ${162 + r * 30} 220 ${182 + r * 30}`} p={k(a + 18 + r * 4, 14)} op={0.6} />
          </g>
        ))}
        {/* there's always more to know: sparks keep rising off the page */}
        {Array.from({ length: 14 }, (_, n) => {
          const t0 = b + n * 6;
          const q = (f - t0) / 50;
          if (q <= 0 || q >= 1) return null;
          const x = 200 + Math.sin(n * 2.4) * (40 + q * 90);
          return <circle key={n} cx={x} cy={140 - q * 130} r={n % 3 === 0 ? 3.5 : 2.2} fill={n % 3 === 0 ? blue : `rgb(${WARM})`} opacity={Math.sin(q * Math.PI) * 0.9} />;
        })}
      </g>
    );
  }
  if (i === 1) {
    const grow = ramp(f, g - 2, 16, softBack); // the word "grow"
    return (
      <g>
        <Draw d="M50 340 L350 340" p={k(a, 20)} op={0.6} />
        {/* the stake — someone standing straight beside you */}
        <Draw d="M240 340 L240 70" p={k(a + 4, 26)} color={blue} w={3} />
        {/* the sprout climbs toward it */}
        <Draw d="M180 340 C180 290 196 250 214 214 C224 190 232 170 236 150" p={ramp(f, b, g - b + 6, cubicInOut)} w={2.5} />
        {/* the tie */}
        <Draw d="M226 190 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" p={k(b + 20, 12)} color={blue} w={1.6} />
        {/* leaves unfurl on "grow" */}
        {[
          { x: 186, y: 285, s: -1, r: 1 },
          { x: 204, y: 238, s: 1, r: 0.85 },
          { x: 232, y: 165, s: -1, r: 1.25 },
        ].map((l, n) => {
          const q = clamp01(grow * 1.3 - n * 0.15);
          return (
            <path key={n} transform={`translate(${l.x} ${l.y}) scale(${l.s * q * l.r} ${q * l.r})`}
              d="M0 0 C-18 -20 -48 -22 -62 -10 C-44 8 -18 10 0 0 Z" fill={n === 2 ? `rgba(${C.blueRGB},0.55)` : `rgba(${WARM},0.18)`}
              stroke={n === 2 ? blue : `rgba(${WARM},0.8)`} strokeWidth={2} />
          );
        })}
        {grow > 0 && <circle cx={236} cy={150} r={60 * grow} fill="none" stroke={blue} strokeWidth={1.5} opacity={0.6 * (1 - ramp(f, g, 24))} />}
      </g>
    );
  }
  if (i === 2) {
    const H = [50, 90, 135, 185, 240];
    return (
      <g>
        <Draw d="M40 340 L360 340" p={k(a, 16)} op={0.6} />
        {H.map((h, n) => {
          const q = ramp(f, a + 8 + n * 9, 16, expoOut);
          const last = n === H.length - 1;
          return (
            <rect key={n} x={52 + n * 62} y={340 - h * q} width={44} height={h * q} fill={last ? `rgba(${C.blueRGB},0.35)` : `rgba(${WARM},0.08)`}
              stroke={last ? blue : `rgba(${WARM},0.75)`} strokeWidth={last ? 2.5 : 1.8} />
          );
        })}
        <Draw d="M300 80 L300 30 M284 48 L300 30 L316 48" p={k(b + 10, 14)} color={blue} w={3} />
      </g>
    );
  }
  // integrity: a compass that swings, then settles on north
  const settle = ramp(f, a, b - a + 20, expoOut);
  const ang = Math.sin((f - a) * 0.22) * 70 * (1 - settle);
  return (
    <g>
      <Draw d="M200 70 a140 140 0 1 1 -0.01 0" p={k(a, 30)} />
      <Draw d="M200 90 a120 120 0 1 1 -0.01 0" p={k(a + 6, 30)} op={0.35} w={1.2} />
      {[0, 90, 180, 270].map((d, n) => (
        <line key={n} x1={200} y1={78} x2={200} y2={98} transform={`rotate(${d} 200 210)`} stroke={`rgba(${WARM},0.7)`} strokeWidth={2} opacity={k(a + 14 + n * 3, 8)} />
      ))}
      <g transform={`rotate(${ang} 200 210)`} opacity={k(a + 10, 12)}>
        <polygon points="200,100 214,210 186,210" fill={blue} />
        <polygon points="200,320 214,210 186,210" fill={`rgba(${WARM},0.5)`} />
        <circle cx={200} cy={210} r={6} fill={`rgb(${WARM})`} />
      </g>
      {/* lead the way: north star */}
      <g opacity={ramp(f, b + 10, 16)} transform="translate(200 30)">
        <path d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill={blue} />
      </g>
    </g>
  );
};

/** A lyric line whose words land as they are sung; "grow" grows. */
const SungLine: React.FC<{ words: { w: string; at: number }[]; f: number; out: number }> = ({ words, f, out }) => (
  <div style={{ fontFamily: F.narrative, fontWeight: 300, fontSize: 40, color: C.warm, lineHeight: 1.22, whiteSpace: "nowrap", opacity: 1 - out, transform: `translateY(${-out * 12}px)` }}>
    {words.map((wd, n) => {
      const dt = f - wd.at;
      const p = cubicOut(clamp01((dt + 2) / 8));
      const isGrow = /^grow/i.test(wd.w);
      const gs = isGrow ? mix(1, 2.1, softBack(clamp01(dt / 14))) : 1;
      return (
        <span key={n} style={{ display: "inline-block", marginRight: isGrow ? 0 : "0.26em", opacity: p,
          transform: `translateY(${(1 - p) * 14}px)`,
          fontSize: `${gs}em`, fontWeight: isGrow ? 500 : 300, color: isGrow && dt > 0 ? C.blue : undefined,
          textShadow: isGrow && dt > 0 ? `0 0 ${18 * (1 - clamp01(dt / 30))}px rgba(${C.blueRGB},0.9)` : undefined }}>
          {wd.w}
        </span>
      );
    })}
  </div>
);

const LX = 560; // the margin line

/**
 * Bridge — the one intimate chapter: warm dark, serif type, dust in a single
 * pool of light, and one vertical line like a page margin.
 */
export const BridgeWorld: React.FC = () => {
  const { f, L, W, dur, txt } = useWorld("bridge");
  const V = [
    { a: L("learn"), b: L("learn2"), id: "learn2", n: "i.", w: "Learn.", s: txt("learn2") },
    { a: L("teach"), b: L("teach2"), id: "teach2", n: "ii.", w: "Teach.", s: txt("teach2") },
    { a: L("improve2"), b: L("improve3"), id: "improve3", n: "iii.", w: "Improve.", s: txt("improve3") },
    { a: L("integrity"), b: L("integrity2"), id: "integrity2", n: "iv.", w: "Absolute\nIntegrity.", s: txt("integrity2") },
  ];
  const GROW = W("teach2", 4);
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
            <SungLine words={v.s.split(" ").map((w, k) => ({ w, at: W(v.id, k) }))} f={f} out={out} />
          </div>
        );
      })}
      {/* background glyph for each value */}
      {V.map((v, i) => {
        const next = V[i + 1]?.a ?? ROT + 10;
        if (f < v.a - 4 || f > next + 2) return null;
        const out = ramp(f, next - 10, 12, sineInOut);
        return (
          <svg key={`ic${i}`} width={440} height={440} viewBox="0 0 400 400"
            style={{ position: "absolute", left: 1370, top: 250, opacity: 1 - out, overflow: "visible", filter: `drop-shadow(0 0 10px rgba(${C.blueRGB},0.35))` }}>
            <ValueIcon i={i} f={f} a={v.a} b={v.b} g={GROW} />
          </svg>
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

